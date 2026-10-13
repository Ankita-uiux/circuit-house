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

  if (!process.env.OPENAI_API_KEY) {
    req.log.error("OPENAI_API_KEY is not configured");
    res.status(502).json({ error: "The shopping assistant is not configured." });
    return;
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const { message, history } = parsed.data;
    const behaviorSettings = await getAssistantBehaviorSettings();
    const catalogForModel = products.map(
      ({ id, name, brand, category, price, description, specs, tags }) => ({
        id,
        name,
        brand,
        category,
        priceInr: price,
        description,
        specs,
        tags,
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
            },
            required: ["reply", "productIds"],
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
          content: `Shopper's latest message: ${message}\n\nAvailable product catalog (prices in Indian rupees, reference prices checked October 2026):\n${JSON.stringify(catalogForModel)}`,
        },
      ],
    });
    const raw = completion.choices[0]?.message.content;
    if (!raw) {
      throw new Error("The recommendation model returned an empty response.");
    }

    const result = JSON.parse(raw) as { reply?: unknown; productIds?: unknown };
    const validIds = new Set(products.map((product) => product.id));
    const rawIds: unknown[] = Array.isArray(result.productIds) ? result.productIds : [];
    const recommendedIds = [...new Set(rawIds)]
      .filter((id): id is string => typeof id === "string" && validIds.has(id))
      .slice(0, 3);
    const recommendedProducts = recommendedIds
      .map((id) => products.find((product) => product.id === id))
      .filter((product) => product !== undefined);

    res.json(
      GetShoppingAssistantReplyResponse.parse({
        reply:
          typeof result.reply === "string" && result.reply.trim()
            ? result.reply.trim()
            : "Tell me a little more about what you're looking for, and I'll narrow down the catalog.",
        products: recommendedProducts.map(withIcecatImage),
      }),
    );
  } catch (error) {
    req.log.error({ error }, "Shopping assistant request failed");
    res.status(502).json({ error: "The shopping assistant is temporarily unavailable." });
  }
});

export default router;
