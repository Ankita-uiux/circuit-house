import { Router, type IRouter } from "express";
import {
  GetShoppingAssistantReplyBody,
  GetShoppingAssistantReplyResponse,
  ListProductsResponse,
} from "@workspace/api-zod";
import OpenAI from "openai";
import {
  buildAssistantSystemPrompt,
  getAssistantBehaviorSettings,
} from "../lib/assistant-behavior";
import { catalog, type CatalogProduct } from "../data/catalog";
import { withIcecatImage } from "../lib/icecat";
import { ensureSession, getConversation, logMessage, saveSessionState, sessionIdFrom } from "../lib/chat-log";
import { normalizeState, stateForModel, updateConversationState, type ConversationState, type StateUpdate } from "../lib/conversation-state";
import { lookupMarket, type MarketResult } from "../lib/market-search";
import { marketProductFromEvidence, marketProductPhotos, type MarketProduct } from "../lib/market-products";
import { withStoreDetails, type StoreProduct } from "../lib/product-extras";
import { enrichmentFor } from "../lib/product-enrichment";
import { allowedProducts, overBudgetBy, sanitizeReply } from "../lib/reply-filters";
import { isPin, storeServiceContext } from "../lib/store-services";

const router: IRouter = Router();

type Comparison = { products: Array<{ id: string; name: string; price: number }>; rows: Array<{ label: string; values: Array<{ text: string; meetsRequirement: boolean }> }> };

/** Functional context for every turn. Persona, tone and wording rules live in the owner's settings prompt. */
const CONVERSATION_STATE_RULES = `Conversation state:
- conversationState is what is known so far in this conversation (category, budget_max, budget_stretch, use_case, brands_include, brands_exclude, must_haves, items_in_bag, last_discussed). It is already updated for the latest message; the newest value always wins over anything earlier in the chat.
- Never ask again for something conversationState already has, unless the shopper seems unsure.
- brands_exclude removes those brands only, never the whole category.
- When the shopper says "cheaper", "other" or "another one", it refers to last_discussed (which may be an add-on such as a cable), not the main product. howTheLatestMessageWasRead explains how the latest message was understood; follow it.
- items_in_bag is what the shopper has in their bag right now. You can refer to it, and avoid suggesting an item they already have.
- quotedEarlierMessage, when present, is an earlier assistant message the shopper is replying to; answer in relation to it.
- conversationState.verbosity is the shopper's chosen reply length (short, normal or detailed) and conversationState.mode is "help-me-choose" or "know-what-i-want" when chosen. Respect them.

Products for this turn:
- localCatalog has already been filtered to the shopper's category, budget (up to budget_stretch) and brand exclusions. Only recommend from it, from sessionProducts, or from externalProducts backed by marketResearch. If localCatalog and sessionProducts are empty because the category is not known yet, recommend nothing and find out what they are shopping for.
- A product priced above budget_max (but within budget_stretch) is shown with a "+₹X over budget" label; say so honestly when you suggest it.
- sessionProducts are products already found on the web earlier in this conversation; reuse their exact IDs and prices.
- options: the tappable choices shown under your reply (3–6 when you ask a question, the action buttons in stages 3 and 4, otherwise 2–3 short follow-ups the shopper might tap, in their voice). Each under 30 characters. Never offer a store expert as an option: handovers use the handover field.
- productNotes: one entry per productId you return (why, headsUp). comparison: only for "Compare all 3", otherwise null. cartAddId: only when the shopper clearly asked to add that product to the cart; otherwise null.
- conversationStage and missingSlots are computed from conversationState: follow the stage rules for that stage.
- storeServices, when present, holds demo results for order lookup, returns, exchange estimates and delivery by PIN code, plus store policies. Answer service questions only from it, and ask for the order ID, PIN code or old model when needed.`;

function storeProduct(product: CatalogProduct, pin: string | null = null): StoreProduct {
  return withStoreDetails(withIcecatImage(product), enrichmentFor(product.id), pin);
}

router.get("/shop/products", (req, res): void => {
  const pin = isPin(req.query.pin) ? req.query.pin : null;
  res.json(ListProductsResponse.parse(catalog.map((product) => storeProduct(product, pin))));
});

/** One product for its product page. Web-found products are looked up in the shopper's conversation. */
router.get("/shop/products/:id", async (req, res): Promise<void> => {
  const pin = isPin(req.query.pin) ? req.query.pin : null;
  const local = catalog.find((product) => product.id === req.params.id);
  if (local) {
    res.json(storeProduct(local, pin));
    return;
  }
  const sessionId = sessionIdFrom(req);
  if (sessionId && req.params.id.startsWith("market-")) {
    const conversation = await getConversation(sessionId).catch(() => null);
    const cached = normalizeState(conversation?.state).web_products.find((product) => product.id === req.params.id);
    if (cached) {
      res.json(cached);
      return;
    }
  }
  res.status(404).json({ error: "Product not found." });
});

const OFF_TOPIC_STEER: Record<string, string> = {
  Phones: "a phone that fits your budget",
  Laptops: "a laptop that fits your course",
  Tablets: "a tablet for your classes",
  Audio: "the right earbuds or headphones",
  Wearables: "the right smartwatch",
  Accessories: "the right accessories",
  Cameras: "the right camera",
  Gaming: "the right gaming gear",
  TVs: "the right TV",
};

const HUMAN_REPLY = "Sure! I’m connecting you with a Circuit House store expert now. I’ve shared what we’ve talked about, so you won’t need to repeat anything. They’ll message you here in about a minute.";
/** Reply while the shopper waits for the expert and asks for a person again. */
const WAITING_REPLY = "Thanks for your patience! Your expert will be with you shortly. Anything quick I can help with meanwhile?";
const OFFER_OPTIONS = ["Chat with an expert", "Try another way"];
type HandoverReason = "asked" | "cant-handle" | "frustrated" | "circles" | "confused";
const HANDOVER_REASONS: HandoverReason[] = ["asked", "cant-handle", "frustrated", "circles", "confused"];
const HANDOVER_LABELS: Record<HandoverReason, string> = {
  asked: "asked for a person", "cant-handle": "something the assistant can’t handle", frustrated: "shopper seemed frustrated", circles: "conversation going in circles", confused: "shopper stayed confused",
};
/** Options the model might still add for a human; handovers go through the handover field instead. */
const EXPERT_OPTION = /\b(store expert|talk to (a |an )?(human|person|agent)|human agent|real person|customer care)\b/i;
const HUMAN_REQUEST = /\b(talk|speak|connect|chat)\s+(to|with)\s+(a\s+|an\s+|some\s*one|the\s+)?(human|person|real person|agent|executive|store (staff|expert)|staff|expert|someone)\b|\b(customer care|call me back|human agent|real human)\b/i;

function offTopicReply(state: ConversationState) {
  return `I can't help with that, but I can help you find ${state.category ? OFF_TOPIC_STEER[state.category] : "the right gadget for college"}.`;
}

/** A plain side-by-side table from catalog data, used if the model doesn't return one. */
/** Named spec rows pulled from each product's spec list, so a comparison always shows real specs. */
const SPEC_ROWS: Array<{ label: string; match: RegExp }> = [
  { label: "Processor", match: /snapdragon|dimensity|tensor|exynos|bionic|\bcore (?:i\d|ultra|\d)|ryzen|\bm\d\b|apple m|\bchip\b|processor|helio|intel|\bgen \d/i },
  { label: "Memory", match: /\b\d+\s?gb\b.*(?:ram|storage|ssd)|\bram\b|\bssd\b|storage/i },
  { label: "Display", match: /display|amoled|oled|\blcd\b|\bips\b|\d(?:\.\d)?["”]|\d+\s?hz|inch/i },
  { label: "Camera", match: /\bmp\b|\d+mp|camera/i },
  { label: "Battery", match: /mah|battery|hours?|hrs?\b|charging/i },
  { label: "Sound", match: /\banc\b|noise|driver|audio|spatial|dolby|speaker/i },
  { label: "Weight", match: /\bkg\b|\d+\s?g\b(?!b)|weight|grams/i },
];
export function specRows(products: StoreProduct[]): Comparison["rows"] {
  const used = products.map(() => new Set<number>());
  const rows: Comparison["rows"] = [];
  for (const spec of SPEC_ROWS) {
    const values = products.map((product, column) => {
      const index = product.specs.findIndex((text, i) => !used[column].has(i) && spec.match.test(text));
      if (index < 0) return null;
      used[column].add(index);
      return product.specs[index];
    });
    if (values.filter(Boolean).length >= Math.min(2, products.length)) {
      rows.push({ label: spec.label, values: values.map((text) => ({ text: text ?? "—", meetsRequirement: false })) });
    }
  }
  return rows;
}

function basicComparison(products: StoreProduct[], state: ConversationState): Comparison {
  const inr = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
  const ceiling = state.budget_stretch ?? state.budget_max;
  const rows: Comparison["rows"] = [
    { label: "Price", values: products.map((product) => ({ text: inr(product.price), meetsRequirement: ceiling !== null && product.price <= ceiling })) },
    { label: "Brand", values: products.map((product) => ({ text: product.brand, meetsRequirement: false })) },
    ...specRows(products),
  ];
  if (products.some((product) => product.rating)) {
    rows.push({ label: "Rating", values: products.map((product) => ({ text: product.rating ? `${product.rating.toFixed(1)} ★${product.reviewCount ? ` (${product.reviewCount.toLocaleString("en-IN")})` : ""}` : "No ratings yet", meetsRequirement: false })) });
  }
  return { products: products.map(({ id, name, price }) => ({ id, name, price })), rows };
}

/** Adds spec rows the model left out, so "Compare all" never shows just price and one spec. */
function withSpecRows(comparison: Comparison, products: StoreProduct[]): Comparison {
  const have = comparison.rows.map((row) => row.label.toLowerCase());
  const covers = (label: string) => have.some((existing) => existing.includes(label.toLowerCase()) || (label === "Memory" && /ram|storage/.test(existing)) || (label === "Processor" && /chip|cpu/.test(existing)) || (label === "Display" && /screen/.test(existing)));
  const extra = specRows(products).filter((row) => !covers(row.label));
  return { ...comparison, rows: [...comparison.rows, ...extra].slice(0, 9) };
}

/** Which stage of the team's conversation flow we are in, and which slots are still missing. */
function conversationStage(state: ConversationState) {
  const missing: string[] = [];
  if (!state.category) missing.push("category");
  if (!state.use_case) missing.push("use");
  if (state.budget_max === null) missing.push("budget");
  if (!state.brand_no_preference && !state.brands_include.length && !state.brands_exclude.length) missing.push("brand");
  const shown = state.last_discussed.products.length > 0 && state.last_discussed.category === state.category;
  const stage = !state.category ? 1 : missing.length ? 2 : shown ? 4 : 3;
  return { stage, missing };
}

router.post("/shop/assistant/reply", async (req, res): Promise<void> => {
  const parsed = GetShoppingAssistantReplyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Acknowledge a research turn only after it has been saved centrally.
  const sessionId = sessionIdFrom(req);
  const startedAt = Date.now();
  let stored: Awaited<ReturnType<typeof getConversation>> = null;
  if (sessionId) {
    const snapshot = await getAssistantBehaviorSettings().then(
      ({ persona, tone, initiativeGoal, empathyExamples, teamPrompt, happyPathFlow, humanHandover, empathyScale, goalOrientationScale }) =>
        ({ persona, tone, initiativeGoal, empathyExamples, teamPrompt, happyPathFlow, humanHandover, empathyScale, goalOrientationScale }),
      () => undefined,
    );
    try {
      await ensureSession(sessionId, req.get("user-agent"), snapshot);
      stored = await getConversation(sessionId);
      if (!parsed.data.deferred) {
        await logMessage(sessionId, "user", parsed.data.message, [], null, parsed.data.quote ? { quote: parsed.data.quote.slice(0, 2000) } : null);
      }
    } catch {
      res.status(503).json({ error: "Your message could not be saved. Please try again." });
      return;
    }
  }

  if (!process.env.OPENAI_API_KEY) {
    req.log.error("OPENAI_API_KEY is not configured");
    if (sessionId) await logMessage(sessionId, "error", "The shopping assistant is not configured (no OpenAI key).").catch(() => undefined);
    res.status(502).json({ error: "The shopping assistant is not configured." });
    return;
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const { message, quote } = parsed.data;
    const behaviorSettings = await getAssistantBehaviorSettings();
    // Full saved history for this conversation (the client's short history is only a fallback).
    const history: Array<{ role: "user" | "assistant"; content: string }> = stored
      ? stored.messages.map(({ role, content }: { role: string; content: string }) => ({ role: role as "user" | "assistant", content })).slice(-40)
      : parsed.data.history.map(({ role, content }) => ({ role, content }));
    if (parsed.data.deferred && history.at(-1)?.role === "assistant") {
      // The deferred request is already in the saved history; don't send it twice.
      const index = history.map((turn) => turn.content).lastIndexOf(message);
      if (index >= 0) history.splice(index, 1);
    }
    let state = normalizeState(stored?.state);
    state.items_in_bag = (parsed.data.bag ?? []).map(({ id, name, quantity, price }) => ({ id, name, quantity, price }));
    if (parsed.data.preferences?.verbosity) state.verbosity = parsed.data.preferences.verbosity;
    if (parsed.data.preferences && parsed.data.preferences.mode !== undefined) state.mode = parsed.data.preferences.mode ?? null;
    const lastAssistant = [...history].reverse().find((turn) => turn.role === "assistant")?.content ?? null;
    let update: StateUpdate;
    try {
      update = await updateConversationState(openai, state, { message, lastAssistant, quote: quote ?? null });
    } catch (error) {
      req.log.warn({ error: String(error) }, "State update failed; keeping the previous state");
      update = { state, intent: "shopping", interpretation: "" };
    }
    state = update.state;

    type Extras = { options?: string[]; comparison?: Comparison | null; cartAdd?: StoreProduct | null; handover?: { action: "connect" | "offer"; reason: HandoverReason } | null };
    const finish = async (reply: string, cards: StoreProduct[], market: MarketResult, extraLog = "", kind: "reply" | "human" | "off-topic" = "reply", extras: Extras = {}) => {
      const suggestions = extras.options ?? [];
      const comparison = extras.comparison ?? null;
      const cartAdd = extras.cartAdd ?? null;
      const marketForUi = { status: market.status, checkedAt: market.checkedAt, sources: [] as Array<{ title: string; url: string }> };
      let messageId: number | null = null;
      if (sessionId) {
        await saveSessionState(sessionId, state).catch((error) => req.log.warn({ error: String(error) }, "Could not save conversation state"));
        messageId = await logMessage(sessionId, "assistant", reply + extraLog, cards.map((product) => product.id), Date.now() - startedAt,
          { display: reply, products: cards, market: marketForUi, intent: update.intent, interpretation: update.interpretation || undefined, kind, suggestions, comparison, cartAdd: cartAdd ? { id: cartAdd.id, name: cartAdd.name } : null, handover: extras.handover ?? null });
      }
      res.json(GetShoppingAssistantReplyResponse.parse({ reply, products: cards, market: marketForUi, messageId, kind, suggestions, comparison, cartAdd }));
    };
    const noMarket: MarketResult = { status: "not-needed", checkedAt: null, sources: [], evidence: "" };

    // A request for a person (typed, or the [Chat with an expert] button): connect at once, logged for the study.
    if (parsed.data.requestHuman || update.intent === "human" || HUMAN_REQUEST.test(message)) {
      update.intent = "human";
      if (state.handover.expert_on_the_way) {
        await finish(WAITING_REPLY, [], noMarket, "\n\n[Handover: shopper asked again while waiting for the expert]");
        return;
      }
      state.handover = { ...state.handover, expert_on_the_way: true };
      await finish(HUMAN_REPLY, [], noMarket, `\n\n[Handover: connected · ${HANDOVER_LABELS.asked}]`, "human", { handover: { action: "connect", reason: "asked" } });
      return;
    }

    // Off-topic guardrail: no search, no answer to the topic, one line back to shopping.
    if (update.intent === "off-topic") {
      await finish(offTopicReply(state), [], noMarket, "", "off-topic", { options: state.category ? [] : ["Laptop", "Phone", "Headphones", "Something else"] });
      return;
    }

    const isService = update.intent === "store-service";
    const recentUserText = history.filter((turn) => turn.role === "user").slice(-3).map((turn) => turn.content);
    const storeServices = isService ? await storeServiceContext(message, recentUserText, null) : null;

    const sessionWebProducts = state.web_products as unknown as StoreProduct[];
    let allowedLocal = isService ? [] : allowedProducts(state, catalog);
    // Fewer than 3 fit: also offer the nearest option(s) above budget, labelled with how far over.
    if (!isService && state.category && allowedLocal.length < 3) {
      const nearest = allowedProducts({ ...state, budget_max: null, budget_stretch: null }, catalog)
        .filter((product) => !allowedLocal.includes(product) && (state.budget_stretch ?? state.budget_max ?? Infinity) < product.price)
        .sort((a, b) => a.price - b.price).slice(0, Math.min(2, 3 - allowedLocal.length));
      allowedLocal = [...allowedLocal, ...nearest];
    }
    const flow = conversationStage(state);
    const allowedSession = isService ? [] : allowedProducts(state, sessionWebProducts);

    // "Compare all" under three product cards: compare exactly those products.
    const compareIds = (parsed.data.compareIds ?? []).filter((id, index, all) => all.indexOf(id) === index).slice(0, 3);
    const compareProducts = compareIds
      .map((id) => { const local = catalog.find((product) => product.id === id); return local ? storeProduct(local) : sessionWebProducts.find((product) => product.id === id); })
      .filter((product): product is StoreProduct => !!product);
    const isCompare = compareProducts.length >= 2;

    let market: MarketResult = noMarket;
    if (!isService && !isCompare && update.intent === "shopping") {
      try {
        market = await lookupMarket(openai, message, history, catalog.map((product) => product.name));
      } catch (error) {
        req.log.warn({ error: String(error) }, "Market lookup unavailable; continuing with catalog evidence");
        market = { status: "unavailable", checkedAt: null, sources: [], evidence: "" };
      }
    }

    const catalogForModel = allowedLocal.map(({ id, name, brand, category, price, description, specs, tags }) => ({
      id, name, brand, category, priceInr: price, description, specs, tags, overBudgetBy: overBudgetBy(state, price),
    }));
    const sessionForModel = allowedSession.map(({ id, name, brand, category, price, description, specs }) => ({
      id, name, brand, category, priceInr: price, description, specs, overBudgetBy: overBudgetBy(state, price),
    }));
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "circuit_house_recommendation",
          strict: true,
          schema: {
            type: "object",
            properties: {
              reply: { type: "string" },
              productIds: { type: "array", items: { type: "string" }, maxItems: 3 },
              externalProducts: {
                type: "array", maxItems: 3, items: {
                  type: "object", additionalProperties: false,
                  properties: {
                    name: { type: "string" }, brand: { type: "string" }, category: { type: "string", enum: ["Phones", "Laptops", "Tablets", "Audio", "Wearables", "Accessories", "Cameras", "Gaming", "TVs"] },
                    priceInr: { type: "number" }, priceQuote: { type: "string" }, sourceIndex: { type: "integer" },
                    specs: { type: "array", items: { type: "string" }, maxItems: 4 }, description: { type: "string" },
                    colours: { type: "array", items: { type: "string" }, maxItems: 6 },
                    rating: { type: ["number", "null"] }, reviewCount: { type: ["integer", "null"] }, mrpInr: { type: ["number", "null"] },
                  },
                  required: ["name", "brand", "category", "priceInr", "priceQuote", "sourceIndex", "specs", "description", "colours", "rating", "reviewCount", "mrpInr"],
                },
              },
              options: { type: "array", items: { type: "string" }, maxItems: 6 },
              productNotes: {
                type: "array", maxItems: 3, items: {
                  type: "object", additionalProperties: false,
                  properties: { id: { type: "string" }, why: { type: "string" }, headsUp: { type: ["string", "null"] } },
                  required: ["id", "why", "headsUp"],
                },
              },
              comparison: {
                type: ["object", "null"], additionalProperties: false,
                properties: {
                  productIds: { type: "array", items: { type: "string" }, maxItems: 3 },
                  rows: {
                    type: "array", maxItems: 8, items: {
                      type: "object", additionalProperties: false,
                      properties: {
                        label: { type: "string" },
                        values: { type: "array", maxItems: 3, items: { type: "object", additionalProperties: false, properties: { text: { type: "string" }, meetsRequirement: { type: "boolean" } }, required: ["text", "meetsRequirement"] } },
                      },
                      required: ["label", "values"],
                    },
                  },
                },
                required: ["productIds", "rows"],
              },
              cartAddId: { type: ["string", "null"] },
              handover: { type: ["string", "null"], enum: ["connect", "offer", null] },
              handoverReason: { type: ["string", "null"], enum: [...HANDOVER_REASONS, null] },
            },
            required: ["reply", "productIds", "externalProducts", "options", "productNotes", "comparison", "cartAddId", "handover", "handoverReason"],
            additionalProperties: false,
          },
        },
      },
      messages: [
        { role: "system", content: buildAssistantSystemPrompt(behaviorSettings) },
        { role: "system", content: CONVERSATION_STATE_RULES },
        ...history.map((turn) => ({ role: turn.role, content: turn.content })),
        {
          role: "user",
          content: JSON.stringify({
            latestMessage: message,
            quotedEarlierMessage: quote ?? null,
            conversationState: stateForModel(state),
            conversationStage: flow.stage,
            missingSlots: flow.missing,
            howTheLatestMessageWasRead: update.interpretation || null,
            localCatalog: catalogForModel,
            sessionProducts: sessionForModel,
            marketResearch: market,
            compareTheseProducts: isCompare
              ? { instruction: "The shopper tapped Compare all. Fill comparison for exactly these products, in this order, with rows that matter for their use (Price, Processor/Chip, RAM, Storage, Display, Battery, Best for, etc.), bold (meetsRequirement) the values that meet their requirements, and write ONE line naming the best fit for their use and budget. Return no productIds.", products: compareProducts.map(({ id, name, brand, price, specs, description, rating, reviewCount }) => ({ id, name, brand, priceInr: price, specs, description, rating, reviewCount })) }
              : null,
            storeServices,
          }),
        },
      ],
    });
    const raw = completion.choices[0]?.message.content;
    if (!raw) throw new Error("The recommendation model returned an empty response.");

    const result = JSON.parse(raw) as { reply?: unknown; productIds?: unknown; externalProducts?: unknown; options?: unknown; productNotes?: unknown; comparison?: unknown; cartAddId?: unknown; handover?: unknown; handoverReason?: unknown };
    const options = (Array.isArray(result.options) ? result.options : [])
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0 && item.length <= 60)
      .map((item) => sanitizeReply(item.trim())).filter((item) => item && !EXPERT_OPTION.test(item)).slice(0, 6);
    const notes = new Map<string, { why: string; headsUp: string | null }>();
    for (const note of Array.isArray(result.productNotes) ? result.productNotes : []) {
      const row = note as { id?: unknown; why?: unknown; headsUp?: unknown };
      if (typeof row.id === "string" && typeof row.why === "string") {
        notes.set(row.id, { why: sanitizeReply(row.why).slice(0, 240), headsUp: typeof row.headsUp === "string" && row.headsUp.trim() ? sanitizeReply(row.headsUp).slice(0, 200) : null });
      }
    }
    const pool = [...allowedLocal.map((product) => storeProduct(product)), ...allowedSession];
    const byId = new Map(pool.map((product) => [product.id, product]));
    const rawIds: unknown[] = Array.isArray(result.productIds) ? result.productIds : [];
    const recommended = [...new Set(rawIds)].flatMap((id) => (typeof id === "string" && byId.has(id) ? [byId.get(id)!] : []));

    // Web-found products: validated against the research, filtered like catalog items, cached for the session.
    const fresh: StoreProduct[] = [];
    if (!isService) {
      const candidates = (Array.isArray(result.externalProducts) ? result.externalProducts : []).slice(0, 3)
        .map((candidate) => marketProductFromEvidence(candidate, market)).filter((product): product is MarketProduct => product !== null);
      for (const candidate of candidates) {
        const key = candidate.name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
        const cached = sessionWebProducts.find((product) => product.name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() === key);
        if (cached) { fresh.push(cached); continue; }
        const { enrichment, ...base } = candidate;
        const images = await marketProductPhotos(candidate.priceSource.url);
        const product = withStoreDetails({ ...base, image: images[0] ?? null }, { ...enrichment, images }) as StoreProduct;
        fresh.push(product);
      }
    }
    const webAllowed = allowedProducts(state, fresh);
    if (webAllowed.length) {
      const merged = [...sessionWebProducts.filter((product) => !webAllowed.some((item) => item.id === product.id)), ...webAllowed];
      state.web_products = merged.slice(-20) as unknown as ConversationState["web_products"];
    }
    const cards = (state.category && !isCompare ? [...recommended, ...webAllowed] : [])
      .filter((product, index, all) => all.findIndex((item) => item.id === product.id) === index)
      .slice(0, 3)
      .map((product, index) => ({
        ...product,
        overBudgetBy: overBudgetBy(state, product.price),
        why: notes.get(product.id)?.why ?? null,
        headsUp: notes.get(product.id)?.headsUp ?? null,
        bestFit: index === 0 && notes.size > 0,
      }));

    // Products the shopper has seen in this chat (for comparisons and "add to cart").
    const known = new Map<string, StoreProduct>([...catalog.map((product) => [product.id, storeProduct(product)] as const), ...sessionWebProducts.map((product) => [product.id, product] as const), ...cards.map((product) => [product.id, product] as const)]);
    let comparison: Comparison | null = null;
    if (result.comparison && typeof result.comparison === "object") {
      const raw = result.comparison as { productIds?: unknown; rows?: unknown };
      const ids = (Array.isArray(raw.productIds) ? raw.productIds : []).filter((id): id is string => typeof id === "string" && known.has(id)).slice(0, 3);
      const rows = (Array.isArray(raw.rows) ? raw.rows : []).flatMap((row) => {
        const item = row as { label?: unknown; values?: unknown };
        if (typeof item.label !== "string" || !Array.isArray(item.values)) return [];
        const values = item.values.slice(0, ids.length).map((value) => {
          const cell = value as { text?: unknown; meetsRequirement?: unknown };
          return { text: typeof cell.text === "string" ? sanitizeReply(cell.text).slice(0, 80) : "", meetsRequirement: cell.meetsRequirement === true };
        });
        return values.length === ids.length ? [{ label: item.label.slice(0, 40), values }] : [];
      }).slice(0, 8);
      if (ids.length >= 2 && rows.length) comparison = { products: ids.map((id) => ({ id, name: known.get(id)!.name, price: known.get(id)!.price })), rows };
    }
    if (isCompare) {
      const order = compareProducts.map((product) => product.id);
      const sameProducts = comparison && comparison.products.length === order.length && comparison.products.every((product) => order.includes(product.id));
      if (comparison && sameProducts) {
        // Keep the columns in the order the cards were shown.
        const indexOf = comparison.products.map((product) => product.id);
        comparison = {
          products: order.map((id) => comparison!.products[indexOf.indexOf(id)]),
          rows: comparison.rows.map((row) => ({ ...row, values: order.map((id) => row.values[indexOf.indexOf(id)]) })),
        };
        comparison = withSpecRows(comparison, compareProducts);
      } else {
        comparison = basicComparison(compareProducts, state);
      }
    }
    const cartAdd = typeof result.cartAddId === "string" && known.has(result.cartAddId) ? known.get(result.cartAddId)! : null;

    const replyText = sanitizeReply(
      typeof result.reply === "string" && result.reply.trim()
        ? result.reply.trim()
        : "Tell me a little more about what you're looking for, and I'll narrow it down.",
    );
    state.last_discussed = {
      category: cards[0]?.category ?? state.last_discussed.category,
      products: cards.length ? cards.map((product) => product.name) : state.last_discussed.products,
    };
    state = normalizeState(state);
    const sourceLog = market.sources.length ? `\n\nMarket sources (checked ${market.checkedAt}):\n${market.sources.map((source, index) => `[${index + 1}] ${source.title}: ${source.url}`).join("\n")}` : "";
    const webLog = fresh.length ? `\n\nWeb product snapshots:\n${JSON.stringify(fresh.map(({ id, name, price, priceSource }) => ({ id, name, price, source: priceSource.url })))}` : "";
    const serviceLog = storeServices ? `\n\nStore service data:\n${JSON.stringify({ ...storeServices, policies: undefined })}` : "";
    const cartLog = cartAdd ? `\n\n[Added to cart by the assistant: ${cartAdd.name}]` : "";

    // Human handover chosen by the model ("connect" or "offer"), within the limits the app enforces.
    const reason: HandoverReason = HANDOVER_REASONS.includes(result.handoverReason as HandoverReason) ? (result.handoverReason as HandoverReason) : "asked";
    if (result.handover === "connect" && !state.handover.expert_on_the_way) {
      state.handover = { ...state.handover, expert_on_the_way: true };
      await finish(replyText, [], noMarket, `\n\n[Handover: connected · ${HANDOVER_LABELS[reason]}]`, "human", { handover: { action: "connect", reason } });
      return;
    }
    if (result.handover === "offer" && !state.handover.expert_on_the_way && state.handover.offers_made < 2) {
      state.handover = { ...state.handover, offers_made: state.handover.offers_made + 1 };
      await finish(replyText, cards, market, sourceLog + webLog + serviceLog + `\n\n[Handover: offered an expert · ${HANDOVER_LABELS[reason]}]`, "reply", { options: OFFER_OPTIONS, handover: { action: "offer", reason } });
      return;
    }
    await finish(replyText, cards, market, sourceLog + webLog + serviceLog + cartLog, "reply", { options, comparison, cartAdd });
  } catch (error) {
    req.log.error({ error }, "Shopping assistant request failed");
    if (sessionId) await logMessage(sessionId, "error", `Assistant request failed: ${String(error).slice(0, 300)}`).catch(() => undefined);
    res.status(502).json({ error: "The shopping assistant is temporarily unavailable." });
  }
});

export default router;
