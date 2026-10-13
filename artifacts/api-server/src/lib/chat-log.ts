import type { Request } from "express";
import { pool } from "@workspace/db";
import { logger } from "./logger";

/**
 * Saves shopping-assistant conversations for user testing. Logging never
 * breaks the chat: every function here swallows and logs its own errors.
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
      `INSERT INTO chat_sessions (id, settings, user_agent) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET settings = COALESCE(chat_sessions.settings, EXCLUDED.settings),
         user_agent = COALESCE(chat_sessions.user_agent, EXCLUDED.user_agent)`,
      [id, settings === undefined ? null : JSON.stringify(settings), userAgent?.slice(0, 300) ?? null],
    );
  } catch (error) {
    logger.warn({ error: String(error) }, "Chat log: could not create session");
  }
}

export async function logMessage(
  sessionId: string,
  role: "user" | "assistant" | "card" | "error",
  content: string,
  productIds: string[] = [],
  latencyMs: number | null = null,
) {
  try {
    await pool.query(
      `INSERT INTO chat_messages (session_id, role, content, product_ids, latency_ms) VALUES ($1, $2, $3, $4, $5)`,
      [sessionId, role, content.slice(0, 8000), productIds, latencyMs],
    );
  } catch (error) {
    logger.warn({ error: String(error) }, "Chat log: could not save message");
  }
}

export async function setParticipant(sessionId: string, label: string) {
  await pool.query(`UPDATE chat_sessions SET participant = $2 WHERE id = $1`, [sessionId, label || null]);
}

export async function listSessions() {
  const { rows } = await pool.query(`
    SELECT s.id, s.participant, s.created_at AS "createdAt",
           COUNT(m.id) FILTER (WHERE m.role IN ('user', 'assistant'))::int AS "messageCount",
           COALESCE(array_agg(m.content ORDER BY m.id) FILTER (WHERE m.role = 'card'), '{}') AS cards,
           MAX(m.created_at) AS "lastActivityAt"
    FROM chat_sessions s
    LEFT JOIN chat_messages m ON m.session_id = s.id
    GROUP BY s.id
    ORDER BY s.created_at DESC
    LIMIT 500`);
  return rows;
}

export async function getSession(id: string) {
  const session = await pool.query(
    `SELECT id, participant, settings, user_agent AS "userAgent", created_at AS "createdAt" FROM chat_sessions WHERE id = $1`,
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
    SELECT s.id AS session_id, s.participant, s.created_at AS session_started,
           s.settings->>'empathyScale' AS empathy_scale,
           s.settings->>'goalOrientationScale' AS initiative_scale,
           m.id AS message_id, m.created_at AS message_time, m.role, m.content,
           array_to_string(m.product_ids, ' ') AS product_ids, m.latency_ms
    FROM chat_messages m JOIN chat_sessions s ON s.id = m.session_id
    ORDER BY s.created_at, m.id`);
  return rows;
}
