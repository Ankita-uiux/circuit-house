import { pool } from "@workspace/db";
import { logger } from "./logger";

const DEFAULT_GOAL =
  "Help each shopper identify the best-fitting product from the catalog for their needs, budget, and priorities.";

/**
 * Creates the app's table if it doesn't exist and adds any newer columns.
 * Safe to run on every start: it never drops or rewrites data.
 * Mirrors lib/db/src/schema/assistant-behavior.ts — keep the two in sync.
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
  `);
  logger.info("Database tables are ready");
}
