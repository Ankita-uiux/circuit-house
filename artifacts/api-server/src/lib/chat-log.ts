import type { Request } from "express";
import { pool } from "@workspace/db";
import { logger } from "./logger";

/**
 * Saves conversations centrally for every device. Failures propagate so the
 * caller cannot report success before the research data has been saved.
 */

export const TEST_CARDS = [
  "01 Everything at once",
  "02 Change your mind",
  "03 Off-topic",
  "04 Confused",
  "05 Wrong information",
  "06 Vague",
  "07 Ask for a human",
  "08 Hinglish and typos",
  "09 Silence",
] as const;

export const CHAT_SESSION_HEADER = "x-chat-session";
export const NAME_GREETING = "Hi! Before we get started, what should I call you? A first name or nickname is fine.";
export function shoppingGreeting(name: string) {
  return `Nice to meet you, ${name}! Tell me what you’ll use it for and your budget.\n\nI’ll suggest a few options from our catalog and explain the trade-offs in plain words.`;
}

export const NAME_REASK = "Got it, I’ll come back to that in a moment. First, what should I call you? Just your first name is fine.";
export const NAME_RETRY = "Sorry, I didn’t catch your name. What should I call you? Just your first name is fine.";

/** The greeting is saved once per session, before the participant's first reply. */
async function ensureGreeting(client: { query: (text: string, values?: unknown[]) => Promise<{ rowCount: number | null }> }, id: string) {
  const existing = await client.query(`SELECT 1 FROM chat_messages WHERE session_id = $1 LIMIT 1`, [id]);
  if (!existing.rowCount) {
    await client.query(`INSERT INTO chat_messages (session_id, role, content) VALUES ($1, 'assistant', $2)`, [id, NAME_GREETING]);
  }
}

/**
 * Atomic, idempotent onboarding. Saves the participant's reply as typed, the
 * extracted first name, and the greeting. An existing named session is never renamed.
 */
export async function startNamedSession(id: string, name: string, rawReply: string, userAgent: string | undefined, settings: unknown) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query(
      `INSERT INTO chat_sessions (id, title, participant_name, settings, user_agent, name_prompt_enabled)
       VALUES ($1, $2, $2, $3, $4, true) ON CONFLICT (id) DO UPDATE
       SET title = COALESCE(chat_sessions.title, EXCLUDED.title), participant_name = EXCLUDED.participant_name,
           settings = COALESCE(chat_sessions.settings, EXCLUDED.settings)
       WHERE chat_sessions.name_prompt_enabled AND chat_sessions.participant_name IS NULL RETURNING id`,
      [id, name, JSON.stringify(settings), userAgent?.slice(0, 300) ?? null],
    );
    if (inserted.rowCount) {
      await ensureGreeting(client, id);
      await client.query(
        `INSERT INTO chat_messages (session_id, role, content) VALUES ($1, 'user', $2), ($1, 'assistant', $3)`,
        [id, rawReply, shoppingGreeting(name)],
      );
    }
    const result = await client.query(`SELECT participant_name AS "participantName", state FROM chat_sessions WHERE id = $1`, [id]);
    await client.query("COMMIT");
    return { participantName: result.rows[0].participantName as string | null, state: result.rows[0].state as unknown };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** The reply to the name question had no name: save it, ask again, and keep any shopping request for later. */
export async function logNameRetry(id: string, rawReply: string, reply: string, state: unknown, userAgent: string | undefined, settings: unknown) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO chat_sessions (id, settings, user_agent, name_prompt_enabled, state) VALUES ($1, $2, $3, true, $4)
       ON CONFLICT (id) DO UPDATE SET state = EXCLUDED.state, settings = COALESCE(chat_sessions.settings, EXCLUDED.settings)`,
      [id, JSON.stringify(settings), userAgent?.slice(0, 300) ?? null, JSON.stringify(state)],
    );
    await ensureGreeting(client, id);
    await client.query(`INSERT INTO chat_messages (session_id, role, content) VALUES ($1, 'user', $2), ($1, 'assistant', $3)`, [id, rawReply, reply]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getSessionState(id: string): Promise<{ state: unknown; participantName: string | null } | null> {
  const { rows } = await pool.query(`SELECT state, participant_name AS "participantName" FROM chat_sessions WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function saveSessionState(id: string, state: unknown) {
  await pool.query(`UPDATE chat_sessions SET state = $2 WHERE id = $1`, [id, JSON.stringify(state)]);
}

/** Shopper and assistant turns, as the chat UI and the model need them (reply text without research logs). */
export async function getConversation(id: string) {
  const session = await pool.query(
    `SELECT participant_name AS "participantName", state, created_at AS "createdAt" FROM chat_sessions WHERE id = $1`,
    [id],
  );
  if (!session.rows[0]) return null;
  const messages = await pool.query(
    `SELECT id, role, content, meta, created_at AS "createdAt" FROM chat_messages
     WHERE session_id = $1 AND role IN ('user', 'assistant') ORDER BY id`,
    [id],
  );
  return {
    ...session.rows[0],
    messages: messages.rows.map((row: { id: number; role: string; content: string; meta: Record<string, unknown> | null; createdAt: Date }) => ({
      id: row.id,
      role: row.role,
      content: typeof row.meta?.display === "string" ? row.meta.display : row.content,
      meta: row.meta ?? {},
      createdAt: row.createdAt,
    })),
  };
}

export async function renameSession(id: string, title: string) {
  const result = await pool.query(`UPDATE chat_sessions SET title = $2 WHERE id = $1 RETURNING id`, [id, title]);
  return (result.rowCount ?? 0) > 0;
}
const SESSION_ID = /^[A-Za-z0-9-]{8,64}$/;

export function isSessionId(value: unknown): value is string {
  return typeof value === "string" && SESSION_ID.test(value);
}

export function sessionIdFrom(req: Request): string | null {
  const value = req.get(CHAT_SESSION_HEADER);
  return isSessionId(value) ? value : null;
}

/** Creates the session row on first use, with a snapshot of the assistant settings. */
export async function ensureSession(id: string, userAgent: string | undefined, settings: unknown) {
  try {
    await pool.query(
      `INSERT INTO chat_sessions (id, settings, user_agent, name_prompt_enabled) VALUES ($1, $2, $3, true)
       ON CONFLICT (id) DO UPDATE SET settings = COALESCE(chat_sessions.settings, EXCLUDED.settings),
         user_agent = COALESCE(chat_sessions.user_agent, EXCLUDED.user_agent)`,
      [id, settings === undefined ? null : JSON.stringify(settings), userAgent?.slice(0, 300) ?? null],
    );
  } catch (error) {
    logger.warn({ error: String(error) }, "Chat log: could not create session");
    throw error;
  }
}

export async function logMessage(
  sessionId: string,
  role: "user" | "assistant" | "card" | "error",
  content: string,
  productIds: string[] = [],
  latencyMs: number | null = null,
  meta: Record<string, unknown> | null = null,
) {
  try {
    const { rows } = await pool.query(
      `INSERT INTO chat_messages (session_id, role, content, product_ids, latency_ms, meta) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [sessionId, role, content.slice(0, 8000), productIds, latencyMs, meta === null ? null : JSON.stringify(meta)],
    );
    return rows[0].id as number;
  } catch (error) {
    logger.warn({ error: String(error) }, "Chat log: could not save message");
    throw error;
  }
}

export const FEEDBACK_REASONS = [
  "It didn't understand my question",
  "It didn't help me find what I needed",
  "It provided the wrong information",
  "The suggestions were confusing",
  "Too much effort to use",
  "Something else",
] as const;

/** Saves a thumbs up/down (and, for thumbs down, the reasons and details) on one assistant reply, and logs it in the transcript. */
export async function saveFeedback(sessionId: string, messageId: number, rating: "up" | "down" | null, reasons: string[], details: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const target = await client.query(
      `SELECT id FROM chat_messages WHERE id = $1 AND session_id = $2 AND role = 'assistant' FOR UPDATE`,
      [messageId, sessionId],
    );
    if (!target.rowCount) {
      await client.query("ROLLBACK");
      return false;
    }
    const feedback = rating ? { rating, reasons, details: details || undefined, at: new Date().toISOString() } : null;
    await client.query(
      `UPDATE chat_messages SET meta = jsonb_set(COALESCE(meta, '{}'::jsonb), '{feedback}', $2::jsonb) WHERE id = $1`,
      [messageId, JSON.stringify(feedback)],
    );
    const summary = rating === null ? "Feedback removed"
      : rating === "up" ? "Thumbs up"
      : `Thumbs down${reasons.length ? `: ${reasons.join("; ")}` : ""}${details ? ` | Details: ${details}` : ""}`;
    await client.query(
      `INSERT INTO chat_messages (session_id, role, content, meta) VALUES ($1, 'feedback', $2, $3)`,
      [sessionId, `${summary} (on reply #${messageId})`, JSON.stringify({ messageId, rating, reasons, details })],
    );
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function setParticipant(sessionId: string, label: string) {
  await pool.query(`UPDATE chat_sessions SET participant = $2 WHERE id = $1`, [sessionId, label || null]);
}

export async function listSessions(page = 1) {
  const pageSize = 50;
  const count = await pool.query(`SELECT COUNT(*)::int AS total FROM chat_sessions`);
  const total = count.rows[0].total as number;
  const currentPage = Math.min(page, Math.max(1, Math.ceil(total / pageSize)));
  const { rows } = await pool.query(`
    SELECT s.id, s.title, s.participant, s.participant_name AS "participantName", s.created_at AS "createdAt",
           COUNT(m.id) FILTER (WHERE m.role IN ('user', 'assistant'))::int AS "messageCount",
           COALESCE(array_agg(m.content ORDER BY m.id) FILTER (WHERE m.role = 'card'), '{}') AS cards,
           MAX(m.created_at) AS "lastActivityAt"
    FROM chat_sessions s
    LEFT JOIN chat_messages m ON m.session_id = s.id
    GROUP BY s.id
    ORDER BY s.created_at DESC, s.id DESC
    LIMIT $1 OFFSET $2`, [pageSize, (currentPage - 1) * pageSize]);
  return { sessions: rows, total, page: currentPage, pageSize };
}

export async function getSession(id: string) {
  const session = await pool.query(
    `SELECT id, title, participant, participant_name AS "participantName", settings, user_agent AS "userAgent", created_at AS "createdAt" FROM chat_sessions WHERE id = $1`,
    [id],
  );
  if (!session.rows[0]) return null;
  const messages = await pool.query(
    `SELECT id, role, content, product_ids AS "productIds", latency_ms AS "latencyMs", created_at AS "createdAt"
     FROM chat_messages WHERE session_id = $1 ORDER BY id`,
    [id],
  );
  return { ...session.rows[0], messages: messages.rows };
}

export async function deleteSession(id: string) {
  const result = await pool.query(`DELETE FROM chat_sessions WHERE id = $1`, [id]);
  return (result.rowCount ?? 0) > 0;
}

/** Every saved message, one row each, for spreadsheet analysis. */
export async function exportRows() {
  const { rows } = await pool.query(`
    SELECT s.id AS session_id, s.title AS chat_title, s.participant, s.participant_name, s.created_at AS session_started,
           s.settings->>'empathyScale' AS empathy_scale,
           s.settings->>'goalOrientationScale' AS initiative_scale,
           m.id AS message_id, m.created_at AS message_time, m.role, m.content,
           array_to_string(m.product_ids, ' ') AS product_ids, m.latency_ms
    FROM chat_messages m JOIN chat_sessions s ON s.id = m.session_id
    ORDER BY s.created_at, m.id`);
  return rows;
}
