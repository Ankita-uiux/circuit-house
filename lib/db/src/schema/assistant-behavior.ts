import { sql } from "drizzle-orm";
import {
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const assistantBehaviorSettingsTable = pgTable(
  "assistant_behavior_settings",
  {
    id: integer("id").primaryKey(),
    persona: text("persona").notNull(),
    tone: text("tone").notNull(),
    initiativeGoal: text("initiative_goal")
      .notNull()
      .default(
        "Help each shopper identify the best-fitting product from the catalog for their needs, budget, and priorities.",
      ),
    // Five owner-written example replies, one per empathy stage
    // (levels 0, 2-3, 5, 7-8, 10). An empty array means "use the defaults".
    empathyExamples: text("empathy_examples")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    empathyScale: integer("empathy_scale").notNull(),
    goalOrientationScale: integer("goal_orientation_scale").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
);

export const insertAssistantBehaviorSettingsSchema = createInsertSchema(
  assistantBehaviorSettingsTable,
).omit({ updatedAt: true });

export type AssistantBehaviorSettingsRecord =
  typeof assistantBehaviorSettingsTable.$inferSelect;
