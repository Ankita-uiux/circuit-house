import { Router, type IRouter } from "express";
import { requireAdmin } from "../lib/admin-auth";
import { getAssistantBehaviorSettings } from "../lib/assistant-behavior";
import {
  TEST_CARDS,
  deleteSession,
  ensureSession,
  exportRows,
  getSession,
  isSessionId,
  listSessions,
  logMessage,
  setParticipant,
  startNamedSession,
  shoppingGreeting,
  renameSession,
  getConversation,
  getSessionState,
  saveSessionState,
  logNameRetry,
  skipName,
  NAME_RETRY,
  FEEDBACK_REASONS,
  saveFeedback,
} from "../lib/chat-log";
import { normalizeState } from "../lib/conversation-state";
import { parseNameReply } from "../lib/participant-name";

const router: IRouter = Router();

/**
 * The participant's reply to "what should I call you?". Only the first name is
 * saved ("hi i am aryan" -> "Aryan"). If the reply is a shopping request instead,
 * it is kept and returned as pendingRequest once the name arrives, so the shopper
 * never has to repeat it.
 */
router.post("/shop/chat-sessions/:id/start", async (req, res): Promise<void> => {
  const { id } = req.params;
  const raw = typeof req.body?.message === "string" ? req.body.message : typeof req.body?.name === "string" ? req.body.name : "";
  const message = raw.replace(/[\u0000-\u001f]+/g, " ").trim();
  if (!isSessionId(id) || !message || message.length > 1000) {
    res.status(400).json({ error: "Please enter a first name or nickname." });
    return;
  }
  try {
    const settings = await getAssistantBehaviorSettings();
    const existing = await getSessionState(id);
    const state = normalizeState(existing?.state);
    if (existing?.participantName) {
      res.json({ name: existing.participantName, reply: shoppingGreeting(existing.participantName), pendingRequest: null });
      return;
    }
    const parsed = parseNameReply(message);
    if (!parsed.name && parsed.request) {
      // A shopping request instead of a name: skip the name and answer it straight away.
      await skipName(id, message, { ...state, name_skipped: true }, req.get("user-agent"), settings);
      res.json({ name: null, skipped: true, reply: null, pendingRequest: parsed.request });
      return;
    }
    if (!parsed.name) {
      await logNameRetry(id, message, NAME_RETRY, state, req.get("user-agent"), settings);
      res.json({ name: null, reply: NAME_RETRY, pendingRequest: null });
      return;
    }
    const session = await startNamedSession(id, parsed.name, message, req.get("user-agent"), settings);
    if (!session.participantName) {
      res.status(409).json({ error: "This is an older session. Start a new chat to use a name." });
      return;
    }
    const pendingRequest = parsed.request ?? normalizeState(session.state).pending_request;
    if (pendingRequest) await saveSessionState(id, { ...normalizeState(session.state), pending_request: null });
    res.status(200).json({ name: session.participantName, reply: shoppingGreeting(session.participantName), pendingRequest });
  } catch (error) {
    req.log.error({ error }, "Could not start named chat");
    res.status(503).json({ error: "Your chat could not be saved. Please try again." });
  }
});

/** The saved conversation, so a refresh or reopened tab shows the same chat. Anyone with the random session ID can read it. */
router.get("/shop/chat-sessions/:id/conversation", async (req, res): Promise<void> => {
  const { id } = req.params;
  if (!isSessionId(id)) {
    res.status(400).json({ error: "Invalid session id." });
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  try {
    const conversation = await getConversation(id);
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found." });
      return;
    }
    const state = normalizeState(conversation.state);
    res.json({
      participantName: conversation.participantName,
      nameStepDone: Boolean(conversation.participantName) || state.name_skipped,
      preferences: { verbosity: state.verbosity, mode: state.mode },
      messages: conversation.messages,
    });
  } catch (error) {
    req.log.error({ error }, "Could not load conversation");
    res.status(500).json({ error: "The conversation could not be loaded." });
  }
});

/** Thumbs up / down on a reply, with reasons and details for thumbs down. */
router.post("/shop/chat-sessions/:id/feedback", async (req, res): Promise<void> => {
  const { id } = req.params;
  const body = (req.body ?? {}) as { messageId?: unknown; rating?: unknown; reasons?: unknown; details?: unknown };
  const rating = body.rating === "up" || body.rating === "down" ? body.rating : body.rating === null ? null : undefined;
  const reasons = Array.isArray(body.reasons) ? body.reasons.filter((item): item is string => (FEEDBACK_REASONS as readonly string[]).includes(item as string)) : [];
  const details = typeof body.details === "string" ? body.details.trim().slice(0, 1500) : "";
  if (!isSessionId(id) || typeof body.messageId !== "number" || !Number.isInteger(body.messageId) || rating === undefined) {
    res.status(400).json({ error: "Invalid feedback." });
    return;
  }
  if (rating === "down" && !reasons.length) {
    res.status(400).json({ error: "Please choose at least one reason." });
    return;
  }
  try {
    if (!await saveFeedback(id, body.messageId, rating, rating === "down" ? reasons : [], rating === "down" ? details : "")) {
      res.status(404).json({ error: "That reply was not found." });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    req.log.error({ error }, "Could not save feedback");
    res.status(500).json({ error: "Your feedback could not be saved." });
  }
});

router.patch("/shop/chat-sessions/:id", requireAdmin, async (req, res): Promise<void> => {
  const { id } = req.params;
  const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  if (!isSessionId(id) || !title || title.length > 100 || /[\r\n\u0000-\u001f]/.test(title)) {
    res.status(400).json({ error: "Enter a chat name between 1 and 100 characters." });
    return;
  }
  try {
    if (!await renameSession(id, title)) {
      res.status(404).json({ error: "Session not found." });
      return;
    }
    res.json({ title });
  } catch (error) {
    req.log.error({ error }, "Could not rename chat");
    res.status(503).json({ error: "The chat name could not be saved." });
  }
});

/** Facilitator events during a test: which card was handed over, and who the participant is. */
router.post("/shop/chat-sessions/:id/events", async (req, res): Promise<void> => {
  const { id } = req.params;
  if (!isSessionId(id)) {
    res.status(400).json({ error: "Invalid session id." });
    return;
  }
  const body = (req.body ?? {}) as { type?: unknown; card?: unknown; label?: unknown };
  try {
    await ensureSession(id, req.get("user-agent"), undefined);
    if (body.type === "inactivity") {
      await logMessage(id, "assistant", "Are you still there?");
      res.json({ ok: true });
      return;
    }
    if (body.type === "card" && typeof body.card === "string" && (TEST_CARDS as readonly string[]).includes(body.card)) {
      await logMessage(id, "card", body.card);
      res.json({ ok: true });
      return;
    }
    if (body.type === "preferences") {
      const prefs = (req.body ?? {}) as { verbosity?: unknown; mode?: unknown };
      const current = normalizeState((await getSessionState(id))?.state);
      const next = normalizeState({ ...current, verbosity: prefs.verbosity ?? current.verbosity, mode: prefs.mode === undefined ? current.mode : prefs.mode });
      await saveSessionState(id, next);
      res.json({ ok: true });
      return;
    }
    if (body.type === "participant" && typeof body.label === "string") {
      const label = body.label.trim().slice(0, 60);
      await setParticipant(id, label);
      res.json({ ok: true });
      return;
    }
    res.status(400).json({ error: "Unknown event." });
  } catch (error) {
    req.log.error({ error }, "Could not save chat session event");
    res.status(500).json({ error: "The event could not be saved." });
  }
});

router.get("/shop/chat-sessions", requireAdmin, async (req, res): Promise<void> => {
  const page = Number(req.query.page ?? 1);
  if (!Number.isSafeInteger(page) || page < 1) {
    res.status(400).json({ error: "Invalid page." });
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  try {
    res.json({ cards: TEST_CARDS, ...await listSessions(page) });
  } catch (error) {
    req.log.error({ error }, "Could not list chat sessions");
    res.status(500).json({ error: "Sessions could not be loaded." });
  }
});

function csvCell(value: unknown) {
  if (value === null || value === undefined) return "";
  const raw = value instanceof Date ? value.toISOString() : String(value);
  const text = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

router.get("/shop/chat-sessions/export.csv", requireAdmin, async (req, res): Promise<void> => {
  try {
    const rows = await exportRows();
    const columns = ["session_id", "chat_title", "participant_name", "participant", "session_started", "empathy_scale", "initiative_scale", "message_id", "message_time", "role", "content", "product_ids", "latency_ms"];
    const lines = [columns.join(","), ...rows.map((row) => columns.map((column) => csvCell((row as Record<string, unknown>)[column])).join(","))];
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="circuit-house-test-sessions.csv"');
    res.send("﻿" + lines.join("\r\n"));
  } catch (error) {
    req.log.error({ error }, "Could not export chat sessions");
    res.status(500).json({ error: "Export failed." });
  }
});

router.get("/shop/chat-sessions/:id", requireAdmin, async (req, res): Promise<void> => {
  const { id } = req.params;
  if (!isSessionId(id)) {
    res.status(400).json({ error: "Invalid session id." });
    return;
  }
  try {
    const session = await getSession(id);
    if (!session) {
      res.status(404).json({ error: "Session not found." });
      return;
    }
    res.json(session);
  } catch (error) {
    req.log.error({ error }, "Could not load chat session");
    res.status(500).json({ error: "Session could not be loaded." });
  }
});

router.delete("/shop/chat-sessions/:id", requireAdmin, async (req, res): Promise<void> => {
  const { id } = req.params;
  if (!isSessionId(id)) {
    res.status(400).json({ error: "Invalid session id." });
    return;
  }
  try {
    res.json({ deleted: await deleteSession(id) });
  } catch (error) {
    req.log.error({ error }, "Could not delete chat session");
    res.status(500).json({ error: "Session could not be deleted." });
  }
});

export default router;
