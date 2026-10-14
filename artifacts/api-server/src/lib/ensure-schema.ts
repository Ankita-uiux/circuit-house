import { pool } from "@workspace/db";
import { logger } from "./logger";

const DEFAULT_GOAL =
  "Help each shopper identify the best-fitting product from the catalog for their needs, budget, and priorities.";

/**
 * Creates the app's tables if they don't exist and adds any newer columns.
 * Safe to run on every start: it never drops or rewrites data.
 * Mirrors lib/db/src/schema/assistant-behavior.ts and chat-log.ts — keep them in sync.
 */
export async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS assistant_behavior_settings (
      id integer PRIMARY KEY,
      persona text NOT NULL,
      tone text NOT NULL,
      initiative_goal text NOT NULL DEFAULT '${DEFAULT_GOAL}',
      empathy_examples text[] NOT NULL DEFAULT '{}'::text[],
      empathy_scale integer NOT NULL,
      goal_orientation_scale integer NOT NULL,
      updated_at timestamp with time zone NOT NULL DEFAULT now()
    );
    ALTER TABLE assistant_behavior_settings
      ADD COLUMN IF NOT EXISTS initiative_goal text NOT NULL DEFAULT '${DEFAULT_GOAL}';
    ALTER TABLE assistant_behavior_settings
      ADD COLUMN IF NOT EXISTS empathy_examples text[] NOT NULL DEFAULT '{}'::text[];

    CREATE TABLE IF NOT EXISTS chat_sessions (
      id text PRIMARY KEY,
      participant text,
      settings jsonb,
      user_agent text,
      created_at timestamp with time zone NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS chat_messages (
      id serial PRIMARY KEY,
      session_id text NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
      role text NOT NULL,
      content text NOT NULL,
      product_ids text[] NOT NULL DEFAULT '{}'::text[],
      latency_ms integer,
      created_at timestamp with time zone NOT NULL DEFAULT now()
    );
    ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS title text;
    ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS participant_name text;
    ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS name_prompt_enabled boolean NOT NULL DEFAULT false;
    ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS state jsonb;
    ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS meta jsonb;
    CREATE INDEX IF NOT EXISTS chat_sessions_created_idx ON chat_sessions (created_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS chat_messages_session_idx ON chat_messages (session_id, id);
  `);
  logger.info("Database tables are ready");
}
