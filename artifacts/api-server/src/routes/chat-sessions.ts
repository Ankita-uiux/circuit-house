import { Router, type IRouter } from "express";
import { requireAdmin } from "../lib/admin-auth";
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
} from "../lib/chat-log";

const router: IRouter = Router();

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
    if (body.type === "card" && typeof body.card === "string" && (TEST_CARDS as readonly string[]).includes(body.card)) {
      await logMessage(id, "card", body.card);
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
  try {
    res.json({ cards: TEST_CARDS, sessions: await listSessions() });
  } catch (error) {
    req.log.error({ error }, "Could not list chat sessions");
    res.status(500).json({ error: "Sessions could not be loaded." });
  }
});

function csvCell(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = value instanceof Date ? value.toISOString() : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

router.get("/shop/chat-sessions/export.csv", requireAdmin, async (req, res): Promise<void> => {
  try {
    const rows = await exportRows();
    const columns = ["session_id", "participant", "session_started", "empathy_scale", "initiative_scale", "message_id", "message_time", "role", "content", "product_ids", "latency_ms"];
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
