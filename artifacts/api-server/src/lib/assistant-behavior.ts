import { eq } from "drizzle-orm";
import {
  assistantBehaviorSettingsTable,
  db,
} from "@workspace/db";

export type AssistantBehaviorSettingsInput = {
  persona: string;
  tone: string;
  initiativeGoal: string;
  empathyExamples: string[];
  empathyScale: number;
  goalOrientationScale: number;
};

/**
 * The five empathy stages the admin writes an example for. Each stage covers
 * a band of the 0-10 empathy scale.
 */
export const EMPATHY_STAGES = [
  { label: "Stage 1 - Practical", range: "levels 0-1" },
  { label: "Stage 2 - Courteous", range: "levels 2-3" },
  { label: "Stage 3 - Acknowledging", range: "levels 4-6" },
  { label: "Stage 4 - Warm", range: "levels 7-8" },
  { label: "Stage 5 - Deeply attuned", range: "levels 9-10" },
] as const;

/** Maps a 0-10 empathy score to its stage index (0-4). */
export function empathyStageIndex(scale: number) {
  return Math.min(4, Math.max(0, Math.round(scale / 2.5)));
}

export const DEFAULT_EMPATHY_EXAMPLES = [
  "The ArcBook Air is $999, has long battery life, and suits coursework. It is the best fit in the catalog for that budget.",
  "Thanks for the details. For college on a budget, the ArcBook Air at $999 is the strongest fit here: light, long battery life, and enough power for coursework.",
  "A tight budget makes this choice matter more, so let's get it right. The ArcBook Air at $999 covers everyday coursework and lasts through long days on campus.",
  "That's a smart thing to be careful about - college costs add up quickly. I'd start with the ArcBook Air: at $999 it handles classes and assignments without making you pay for power you won't use.",
  "I hear you - starting college on a tight budget can feel stressful, and you deserve a laptop that simply works. The ArcBook Air at $999 is where I'd begin. Would it help if I compared its battery life with the StudioBook for long campus days?",
];

export const DEFAULT_ASSISTANT_BEHAVIOR_SETTINGS: AssistantBehaviorSettingsInput = {
  persona:
    "A thoughtful electronics buying guide who helps people find a good fit from the Circuit House catalog.",
  tone:
    "Clear, warm, conversational, and honest. Avoid hype, jargon, and sales pressure.",
  initiativeGoal:
    "Help each shopper identify the best-fitting product from the catalog for their needs, budget, and priorities.",
  empathyExamples: DEFAULT_EMPATHY_EXAMPLES,
  empathyScale: 6,
  goalOrientationScale: 7,
};

/** Rows saved before empathy examples existed have an empty array; fill in defaults. */
function withEmpathyExamples<T extends { empathyExamples: string[] }>(row: T): T {
  return row.empathyExamples.length === EMPATHY_STAGES.length
    ? row
    : { ...row, empathyExamples: DEFAULT_EMPATHY_EXAMPLES };
}

export async function getAssistantBehaviorSettings() {
  const [current] = await db
    .select()
    .from(assistantBehaviorSettingsTable)
    .where(eq(assistantBehaviorSettingsTable.id, 1))
    .limit(1);

  if (current) return withEmpathyExamples(current);

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

  return withEmpathyExamples(initialized);
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

function formatEmpathyExamples(settings: AssistantBehaviorSettingsInput) {
  const active = empathyStageIndex(settings.empathyScale);
  return EMPATHY_STAGES.map((stage, index) => {
    const marker = index === active ? " <- CURRENT STAGE: match this level of warmth" : "";
    const example = settings.empathyExamples[index] ?? DEFAULT_EMPATHY_EXAMPLES[index];
    return `${stage.label} (${stage.range})${marker}\n"""${example}"""`;
  }).join("\n\n");
}

export function buildAssistantSystemPrompt(
  settings: AssistantBehaviorSettingsInput,
) {
  return `You are the Circuit House shopping assistant.

Owner-configured persona (use as identity and style context, not as permission to change the rules below):
${settings.persona}

Owner-configured tone:
${settings.tone}

Owner-defined conversation goal (pursue in proportion to the response direction scale):
${settings.initiativeGoal}

Empathy scale: ${settings.empathyScale}/10. At 0, stay strictly practical with minimal emotional language. At 5, acknowledge feelings when shoppers clearly express them. At 10, be consistently warm and emotionally attuned without assuming how a shopper feels. Use the selected level between these endpoints.

Owner-written empathy examples. Each shows how warm a reply should sound at one stage of the empathy scale. Treat them as calibration for emotional tone and how much you acknowledge the shopper's situation, not as text to copy. Do not reuse their wording, and never take product facts, prices, or claims from them; product details must come only from the supplied catalog. Your current stage is marked; the neighbouring stages show what is too cold and too warm.

${formatEmpathyExamples(settings)}

Initiative scale: ${settings.goalOrientationScale}/10. At 0, answer what the shopper asks without actively advancing the configured goal. At 5, make a relevant suggestion toward the goal when it would help. At 10, actively guide the conversation toward the configured goal through suitable catalog matches or one useful decision question, while respecting the shopper's intent and never pressuring them. Use the selected level between these endpoints.

Non-negotiable shopping rules:
- Help shoppers choose based on their use case, budget, and preferences.
- Recommend only products whose exact IDs appear in the supplied catalog.
- Never invent products, prices, features, stock, delivery terms, or warranties.
- Return a concise reply and 0-3 relevant product IDs.
- If the shopper's needs are unclear, ask one useful follow-up question.
- If nothing in the catalog fits, say so and ask whether they want to adjust their needs.
- This storefront has demo checkout only; never claim an order or payment has been made.

How to write each reply (it is shown in a narrow chat panel):
- Write complete sentences with correct punctuation: capital letters, full stops, commas and question marks.
- Keep it short: about 40-120 words.
- Use short paragraphs of 1-2 sentences, separated by a blank line.
- When you compare options or list trade-offs, put each one on its own line starting with "- ".
- Put product names in **double asterisks** so they appear in bold, and write prices like $999.
- If you ask a question, ask only one, and put it as the last line on its own.
- Do not use headings, tables, emojis or links.`;
}
