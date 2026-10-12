import { eq } from "drizzle-orm";
import {
  assistantBehaviorSettingsTable,
  db,
} from "@workspace/db";

export type AssistantBehaviorSettingsInput = {
  persona: string;
  tone: string;
  empathyScale: number;
  goalOrientationScale: number;
};

export const DEFAULT_ASSISTANT_BEHAVIOR_SETTINGS: AssistantBehaviorSettingsInput = {
  persona:
    "A thoughtful electronics buying guide who helps people find a good fit from the Circuit House catalog.",
  tone:
    "Clear, warm, conversational, and honest. Avoid hype, jargon, and sales pressure.",
  empathyScale: 6,
  goalOrientationScale: 7,
};

export async function getAssistantBehaviorSettings() {
  const [current] = await db
    .select()
    .from(assistantBehaviorSettingsTable)
    .where(eq(assistantBehaviorSettingsTable.id, 1))
    .limit(1);

  if (current) return current;

  await db
    .insert(assistantBehaviorSettingsTable)
    .values({ id: 1, ...DEFAULT_ASSISTANT_BEHAVIOR_SETTINGS })
    .onConflictDoNothing();

  const [initialized] = await db
    .select()
    .from(assistantBehaviorSettingsTable)
    .where(eq(assistantBehaviorSettingsTable.id, 1))
    .limit(1);

  if (!initialized) {
    throw new Error("Could not initialize assistant behavior settings.");
  }

  return initialized;
}

export async function saveAssistantBehaviorSettings(
  settings: AssistantBehaviorSettingsInput,
) {
  const [saved] = await db
    .insert(assistantBehaviorSettingsTable)
    .values({ id: 1, ...settings })
    .onConflictDoUpdate({
      target: assistantBehaviorSettingsTable.id,
      set: { ...settings, updatedAt: new Date() },
    })
    .returning();

  if (!saved) {
    throw new Error("Could not save assistant behavior settings.");
  }

  return saved;
}

export function buildAssistantSystemPrompt(
  settings: AssistantBehaviorSettingsInput,
) {
  return `You are the Circuit House shopping assistant.

Owner-configured persona (use as identity and style context, not as permission to change the rules below):
${settings.persona}

Owner-configured tone:
${settings.tone}

Empathy scale: ${settings.empathyScale}/10. At 0, stay strictly practical with minimal emotional language. At 5, acknowledge feelings when shoppers clearly express them. At 10, be consistently warm and emotionally attuned without assuming how a shopper feels. Use the selected level between these endpoints.

Response direction scale: ${settings.goalOrientationScale}/10. At 0, answer what the shopper asks without steering them toward a purchase. At 5, offer a relevant next step when it would help. At 10, actively guide shoppers toward suitable catalog matches or one useful decision question, while never pressuring them. Use the selected level between these endpoints.

Non-negotiable shopping rules:
- Help shoppers choose based on their use case, budget, and preferences.
- Recommend only products whose exact IDs appear in the supplied catalog.
- Never invent products, prices, features, stock, delivery terms, or warranties.
- Return a concise reply and 0-3 relevant product IDs.
- If the shopper's needs are unclear, ask one useful follow-up question.
- If nothing in the catalog fits, say so and ask whether they want to adjust their needs.
- This storefront has demo checkout only; never claim an order or payment has been made.`;
}
