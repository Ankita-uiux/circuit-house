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
  Phones: "Shall we get back to finding your phone?",
  Laptops: "Shall we get back to finding your laptop?",
  Tablets: "Shall we get back to finding your tablet?",
  Audio: "Shall we get back to your audio pick?",
  Wearables: "Shall we get back to finding your smartwatch?",
  Accessories: "Shall we get back to your accessories?",
  Cameras: "Shall we get back to finding your camera?",
  Gaming: "Shall we get back to your gaming pick?",
  TVs: "Shall we get back to finding your TV?",
};

function offTopicReply(state: ConversationState) {
  const steer = state.category ? OFF_TOPIC_STEER[state.category] : "What are you shopping for today?";
  return `I can only help with shopping at Circuit House. ${steer}`;
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
      ({ persona, tone, initiativeGoal, empathyExamples, empathyScale, goalOrientationScale }) =>
        ({ persona, tone, initiativeGoal, empathyExamples, empathyScale, goalOrientationScale }),
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

    const finish = async (reply: string, cards: StoreProduct[], market: MarketResult, extraLog = "") => {
      const marketForUi = { status: market.status, checkedAt: market.checkedAt, sources: [] as Array<{ title: string; url: string }> };
      let messageId: number | null = null;
      if (sessionId) {
        await saveSessionState(sessionId, state).catch((error) => req.log.warn({ error: String(error) }, "Could not save conversation state"));
        messageId = await logMessage(sessionId, "assistant", reply + extraLog, cards.map((product) => product.id), Date.now() - startedAt,
          { display: reply, products: cards, market: marketForUi, intent: update.intent, interpretation: update.interpretation || undefined });
      }
      res.json(GetShoppingAssistantReplyResponse.parse({ reply, products: cards, market: marketForUi, messageId }));
    };
    const noMarket: MarketResult = { status: "not-needed", checkedAt: null, sources: [], evidence: "" };

    // Off-topic guardrail: no search, no answer to the topic, one line back to shopping.
    if (update.intent === "off-topic") {
      await finish(offTopicReply(state), [], noMarket);
      return;
    }

    const isService = update.intent === "store-service";
    const recentUserText = history.filter((turn) => turn.role === "user").slice(-3).map((turn) => turn.content);
    const storeServices = isService ? await storeServiceContext(message, recentUserText, null) : null;

    const sessionWebProducts = state.web_products as unknown as StoreProduct[];
    const allowedLocal = isService ? [] : allowedProducts(state, catalog);
    const allowedSession = isService ? [] : allowedProducts(state, sessionWebProducts);

    let market: MarketResult = noMarket;
    if (!isService && update.intent === "shopping") {
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
              productIds: { type: "array", items: { type: "string" }, maxItems: 4 },
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
            },
            required: ["reply", "productIds", "externalProducts"],
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
            howTheLatestMessageWasRead: update.interpretation || null,
            localCatalog: catalogForModel,
            sessionProducts: sessionForModel,
            marketResearch: market,
            storeServices,
          }),
        },
      ],
    });
    const raw = completion.choices[0]?.message.content;
    if (!raw) throw new Error("The recommendation model returned an empty response.");

    const result = JSON.parse(raw) as { reply?: unknown; productIds?: unknown; externalProducts?: unknown };
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
    const cards = (state.category ? [...webAllowed, ...recommended] : [])
      .filter((product, index, all) => all.findIndex((item) => item.id === product.id) === index)
      .slice(0, 4)
      .map((product) => ({ ...product, overBudgetBy: overBudgetBy(state, product.price) }));

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
    await finish(replyText, cards, market, sourceLog + webLog + serviceLog);
  } catch (error) {
    req.log.error({ error }, "Shopping assistant request failed");
    if (sessionId) await logMessage(sessionId, "error", `Assistant request failed: ${String(error).slice(0, 300)}`).catch(() => undefined);
    res.status(502).json({ error: "The shopping assistant is temporarily unavailable." });
  }
});

export default router;
