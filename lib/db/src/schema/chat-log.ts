import { sql } from "drizzle-orm";
import { boolean, integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Saved shopping-assistant conversations, for user testing.
 * Mirrored by artifacts/api-server/src/lib/ensure-schema.ts — keep in sync.
 */
export const chatSessionsTable = pgTable("chat_sessions", {
  id: text("id").primaryKey(),
  participant: text("participant"),
  title: text("title"),
  participantName: text("participant_name"),
  namePromptEnabled: boolean("name_prompt_enabled").notNull().default(false),
  /** Assistant behaviour settings in effect when the session started. */
  settings: jsonb("settings"),
  userAgent: text("user_agent"),
  /** Structured "known so far" conversation state (see api-server lib/conversation-state.ts). */
  state: jsonb("state"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const chatMessagesTable = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => chatSessionsTable.id, { onDelete: "cascade" }),
  /** user | assistant | card | error */
  role: text("role").notNull(),
  content: text("content").notNull(),
  productIds: text("product_ids").array().notNull().default(sql`'{}'::text[]`),
  /** Milliseconds the assistant took to answer (assistant rows only). */
  latencyMs: integer("latency_ms"),
  /** What the chat UI needs to redraw the message after a refresh: reply text, product cards, sources, quote, feedback. */
  meta: jsonb("meta"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
