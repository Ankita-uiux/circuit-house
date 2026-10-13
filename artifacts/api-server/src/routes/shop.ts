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
import { ensureSession, logMessage, sessionIdFrom } from "../lib/chat-log";
import { lookupMarket, type MarketResult } from '../lib/market-search';
import { marketProductFromEvidence, marketProductPhoto, type MarketProduct } from '../lib/market-products';

const router: IRouter = Router();

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
  if (sessionId) {
    const snapshot = await getAssistantBehaviorSettings().then(
      ({ persona, tone, initiativeGoal, empathyExamples, empathyScale, goalOrientationScale }) =>
        ({ persona, tone, initiativeGoal, empathyExamples, empathyScale, goalOrientationScale }),
      () => undefined,
    );
    try {
      await ensureSession(sessionId, req.get("user-agent"), snapshot);
      await logMessage(sessionId, "user", parsed.data.message);
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
    const { message, history } = parsed.data;
    const behaviorSettings = await getAssistantBehaviorSettings();
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
        ...history.slice(-10).map((turn) => ({
          role: turn.role as "user" | "assistant",
          content: turn.content,
        })),
        {
          role: "user",
          content: JSON.stringify({ latestMessage: message, localCatalog: catalogForModel, marketResearch: market }),
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
    if (sessionId) {
      const sourceLog = market.sources.length ? `\n\nMarket sources (checked ${market.checkedAt}):\n${market.sources.map((source,index) => `[${index+1}] ${source.title}: ${source.url}`).join('\n')}` : '';
      const externalLog = externalProducts.length ? `\n\nWeb listing snapshots:\n${JSON.stringify(externalProducts)}` : '';
      await logMessage(sessionId, "assistant", replyText + sourceLog + externalLog, replyProducts.map((product) => product.id), Date.now() - startedAt);
    }
    res.json(
      GetShoppingAssistantReplyResponse.parse({
        reply: replyText,
        products: replyProducts.map(withIcecatImage),
        market: { status: market.status, checkedAt: market.checkedAt, sources: market.sources },
      }),
    );
  } catch (error) {
    req.log.error({ error }, "Shopping assistant request failed");
    if (sessionId) await logMessage(sessionId, "error", `Assistant request failed: ${String(error).slice(0, 300)}`).catch(() => undefined);
    res.status(502).json({ error: "The shopping assistant is temporarily unavailable." });
  }
});

export default router;
