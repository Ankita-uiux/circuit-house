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
import { catalog } from "../data/catalog";
import { withIcecatImage } from "../lib/icecat";
import { ensureSession, getConversation, logMessage, saveSessionState, sessionIdFrom } from "../lib/chat-log";
import { normalizeState, updateConversationState, type StateUpdate } from "../lib/conversation-state";
import { lookupMarket, type MarketResult } from '../lib/market-search';
import { marketProductFromEvidence, marketProductPhoto, type MarketProduct } from '../lib/market-products';

const router: IRouter = Router();

/** Functional context for every turn. Persona, tone and wording rules live in the owner's settings prompt. */
const CONVERSATION_STATE_RULES = `Conversation state:
- conversationState is what is known so far in this conversation (category, budget_max, budget_stretch, use_case, brands_include, brands_exclude, must_haves, items_in_bag, last_discussed). It is already updated for the latest message; the newest value always wins over anything earlier in the chat.
- Never ask again for something conversationState already has, unless the shopper seems unsure.
- brands_exclude removes those brands only, never the whole category.
- When the shopper says "cheaper", "other" or "another one", it refers to last_discussed (which may be an add-on such as a cable), not the main product. howTheLatestMessageWasRead explains how the latest message was understood; follow it.
- items_in_bag is what the shopper has in their bag right now. You can refer to it, and avoid suggesting an item they already have.
- quotedEarlierMessage, when present, is an earlier assistant message the shopper is replying to; answer in relation to it.
- conversationState.verbosity is the shopper's chosen reply length (short, normal or detailed) and conversationState.mode is "help-me-choose" or "know-what-i-want" when chosen. Respect them.`;

const products = catalog;

router.get("/shop/products", (_req, res): void => {
  res.json(ListProductsResponse.parse(products.map(withIcecatImage)));
});

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
    let market: MarketResult;
    try {
      market = await lookupMarket(openai, message, history, products.map(product => product.name));
    } catch (error) {
      req.log.warn({ error: String(error) }, 'Market lookup unavailable; continuing with catalog evidence');
      market = { status: 'unavailable', checkedAt: null, sources: [], evidence: '' };
    }
    const catalogForModel = products.map(
      ({ id, name, brand, category, price, description, specs, tags, priceSource }) => ({
        id,
        name,
        brand,
        category,
        priceInr: price,
        description,
        specs,
        tags,
        priceSource,
      }),
    );
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
              productIds: {
                type: "array",
                items: { type: "string" },
                maxItems: 3,
              },
              externalProducts: {
                type: 'array', maxItems: 3, items: {
                  type: 'object', additionalProperties: false,
                  properties: {
                    name: {type:'string'}, brand: {type:'string'}, category: {type:'string',enum:['Phones','Laptops','Tablets','Audio','Wearables','Accessories','Cameras','Gaming','TVs']},
                    priceInr: {type:'number'}, priceQuote: {type:'string'}, sourceIndex: {type:'integer'},
                    specs: {type:'array',items:{type:'string'},maxItems:4}, description: {type:'string'},
                  }, required:['name','brand','category','priceInr','priceQuote','sourceIndex','specs','description'],
                },
              },
            },
            required: ["reply", "productIds", "externalProducts"],
            additionalProperties: false,
          },
        },
      },
      messages: [
        {
          role: "system",
          content: buildAssistantSystemPrompt(behaviorSettings),
        },
        { role: "system", content: CONVERSATION_STATE_RULES },
        ...history.map((turn) => ({
          role: turn.role as "user" | "assistant",
          content: turn.content,
        })),
        {
          role: "user",
          content: JSON.stringify({
            latestMessage: message,
            quotedEarlierMessage: quote ?? null,
            conversationState: state,
            howTheLatestMessageWasRead: update.interpretation || null,
            localCatalog: catalogForModel,
            marketResearch: market,
          }),
        },
      ],
    });
    const raw = completion.choices[0]?.message.content;
    if (!raw) {
      throw new Error("The recommendation model returned an empty response.");
    }

    const result = JSON.parse(raw) as { reply?: unknown; productIds?: unknown; externalProducts?: unknown };
    const validIds = new Set(products.map((product) => product.id));
    const rawIds: unknown[] = Array.isArray(result.productIds) ? result.productIds : [];
    const recommendedIds = [...new Set(rawIds)]
      .filter((id): id is string => typeof id === "string" && validIds.has(id))
      .slice(0, 3);
    const recommendedProducts = recommendedIds
      .map((id) => products.find((product) => product.id === id))
      .filter((product) => product !== undefined);
    const external = (Array.isArray(result.externalProducts) ? result.externalProducts : [])
      .slice(0,3).map(candidate => marketProductFromEvidence(candidate,market)).filter((product): product is MarketProduct => product !== null);
    const externalProducts = await Promise.all([...new Map(external.map(product => [product.id,product])).values()]
      .map(async product => ({ ...product, image: await marketProductPhoto(product.priceSource.url) })));
    const replyProducts = [...externalProducts,...recommendedProducts].slice(0,3);

    const replyText =
      typeof result.reply === "string" && result.reply.trim()
        ? result.reply.trim()
        : "Tell me a little more about what you're looking for, and I'll narrow down the catalog.";
    state.last_discussed = {
      category: replyProducts[0]?.category && replyProducts[0].category !== state.last_discussed.category ? (state.category ?? replyProducts[0].category) : state.last_discussed.category,
      products: replyProducts.length ? replyProducts.map((product) => product.name) : state.last_discussed.products,
    };
    state = normalizeState(state);
    let messageId: number | null = null;
    if (sessionId) {
      await saveSessionState(sessionId, state).catch((error) => req.log.warn({ error: String(error) }, "Could not save conversation state"));
      const sourceLog = market.sources.length ? `\n\nMarket sources (checked ${market.checkedAt}):\n${market.sources.map((source,index) => `[${index+1}] ${source.title}: ${source.url}`).join('\n')}` : '';
      const externalLog = externalProducts.length ? `\n\nWeb listing snapshots:\n${JSON.stringify(externalProducts)}` : '';
      const cards = replyProducts.map(withIcecatImage);
      const marketForUi = { status: market.status, checkedAt: market.checkedAt, sources: market.sources };
      messageId = await logMessage(sessionId, "assistant", replyText + sourceLog + externalLog, replyProducts.map((product) => product.id), Date.now() - startedAt,
        { display: replyText, products: cards, market: marketForUi, intent: update.intent, interpretation: update.interpretation || undefined });
    }
    res.json(
      GetShoppingAssistantReplyResponse.parse({
        reply: replyText,
        products: replyProducts.map(withIcecatImage),
        market: { status: market.status, checkedAt: market.checkedAt, sources: market.sources },
        messageId,
      }),
    );
  } catch (error) {
    req.log.error({ error }, "Shopping assistant request failed");
    if (sessionId) await logMessage(sessionId, "error", `Assistant request failed: ${String(error).slice(0, 300)}`).catch(() => undefined);
    res.status(502).json({ error: "The shopping assistant is temporarily unavailable." });
  }
});

export default router;
