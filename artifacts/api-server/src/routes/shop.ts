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

const router: IRouter = Router();

const products = [
  {
    id: "nova-phone-15",
    name: "Nova Phone 15",
    category: "Phones",
    price: 799,
    description: "A bright, fast everyday phone with a camera that loves low light.",
    image:
      "https://images.unsplash.com/photo-1605236453806-6ff36851218e?auto=format&fit=crop&w=900&q=85",
    rating: 4.8,
    reviewCount: 324,
    tags: ["phone", "camera", "travel", "everyday", "battery", "photo"],
    badge: "Best seller",
  },
  {
    id: "pixelwave-pro",
    name: "Pixelwave Pro",
    category: "Phones",
    price: 999,
    description: "A pro-grade camera system and all-day power in a refined design.",
    image:
      "https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?auto=format&fit=crop&w=900&q=85",
    rating: 4.9,
    reviewCount: 187,
    tags: ["phone", "camera", "creator", "photo", "video", "premium"],
    badge: "Staff pick",
  },
  {
    id: "studio-14",
    name: "StudioBook 14",
    category: "Laptops",
    price: 1299,
    description: "A lightweight workhorse for focused work, creative projects, and study.",
    image:
      "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=900&q=85",
    rating: 4.7,
    reviewCount: 211,
    tags: ["laptop", "work", "student", "creator", "portable", "study"],
    badge: "New",
  },
  {
    id: "arcbook-air",
    name: "ArcBook Air",
    category: "Laptops",
    price: 999,
    description: "A slim laptop with a crisp display and enough stamina for long days.",
    image:
      "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=900&q=85",
    rating: 4.6,
    reviewCount: 156,
    tags: ["laptop", "student", "work", "portable", "travel", "battery"],
    badge: null,
  },
  {
    id: "sonic-one",
    name: "Sonic One Headphones",
    category: "Audio",
    price: 249,
    description: "Comfort-first wireless listening with immersive noise cancellation.",
    image:
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=85",
    rating: 4.8,
    reviewCount: 492,
    tags: ["headphones", "audio", "travel", "music", "noise cancelling", "commute"],
    badge: "Popular",
  },
  {
    id: "studio-buds",
    name: "Studio Buds",
    category: "Audio",
    price: 149,
    description: "Pocket-sized earbuds with clear calls and an easy all-day fit.",
    image:
      "https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?auto=format&fit=crop&w=900&q=85",
    rating: 4.5,
    reviewCount: 278,
    tags: ["earbuds", "audio", "commute", "calls", "portable", "music"],
    badge: null,
  },
  {
    id: "arcsound-mini",
    name: "ArcSound Mini Speaker",
    category: "Audio",
    price: 119,
    description: "A compact wireless speaker with room-filling sound for everyday listening.",
    image:
      "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=900&q=85",
    rating: 4.6,
    reviewCount: 168,
    tags: ["speaker", "audio", "home", "music", "wireless"],
    badge: null,
  },
  {
    id: "pulse-watch",
    name: "Pulse Watch 3",
    category: "Wearables",
    price: 329,
    description: "A bright, lightweight smartwatch for workouts and everyday routines.",
    image:
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=85",
    rating: 4.6,
    reviewCount: 135,
    tags: ["watch", "wearable", "fitness", "workout", "health", "everyday"],
    badge: null,
  },
  {
    id: "playcore-x",
    name: "PlayCore X Controller",
    category: "Gaming",
    price: 79,
    description: "A responsive wireless controller built for long gaming sessions.",
    image:
      "https://images.unsplash.com/photo-1600080972464-8e5f35f63d08?auto=format&fit=crop&w=900&q=85",
    rating: 4.7,
    reviewCount: 204,
    tags: ["gaming", "controller", "games", "wireless", "console"],
    badge: "Under $100",
  },
] as const;

router.get("/shop/products", (_req, res): void => {
  res.json(ListProductsResponse.parse(products));
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
    const catalog = products.map(
      ({ id, name, category, price, description, tags }) => ({
        id,
        name,
        category,
        price,
        description,
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
          content: `Shopper's latest message: ${message}\n\nAvailable product catalog:\n${JSON.stringify(catalog)}`,
        },
      ],
    });
    const raw = completion.choices[0]?.message.content;
    if (!raw) {
      throw new Error("The recommendation model returned an empty response.");
    }

    const result = JSON.parse(raw) as { reply?: unknown; productIds?: unknown };
    const validIds = new Set(products.map((product) => product.id));
    type ProductId = (typeof products)[number]["id"];
    const rawIds: unknown[] = Array.isArray(result.productIds) ? result.productIds : [];
    const recommendedIds = [...new Set(rawIds)]
      .filter(
        (id): id is ProductId =>
          typeof id === "string" && validIds.has(id as ProductId),
      )
      .slice(0, 3);
    const recommendedProducts = recommendedIds
      .map((id) => products.find((product) => product.id === id))
      .filter((product): product is (typeof products)[number] => product !== undefined);

    res.json(
      GetShoppingAssistantReplyResponse.parse({
        reply:
          typeof result.reply === "string" && result.reply.trim()
            ? result.reply.trim()
            : "Tell me a little more about what you're looking for, and I'll narrow down the catalog.",
        products: recommendedProducts,
      }),
    );
  } catch (error) {
    req.log.error({ error }, "Shopping assistant request failed");
    res.status(502).json({ error: "The shopping assistant is temporarily unavailable." });
  }
});

export default router;
