import { Router, type IRouter } from "express";
import { requireAdmin } from "../lib/admin-auth";
import { catalog } from "../data/catalog";
import { enrichmentStatus, startEnrichment } from "../lib/product-enrichment";
import { deliveryEstimate, exchangeEstimate, findOrder, isPin, newOrderId, requestReturn, saveOrder, type OrderItem } from "../lib/store-services";
import { getConversation, sessionIdFrom } from "../lib/chat-log";
import { normalizeState } from "../lib/conversation-state";

/** Demo store services: delivery by PIN, order lookup, returns and exchange estimates. */
const router: IRouter = Router();

router.get("/shop/delivery", (req, res): void => {
  const pin = typeof req.query.pin === "string" ? req.query.pin.trim() : "";
  if (!isPin(pin)) {
    res.status(400).json({ error: "Enter a 6-digit PIN code." });
    return;
  }
  res.json(deliveryEstimate(pin));
});

const PAYMENTS = ["UPI", "Card", "EMI", "COD"];
const text = (value: unknown, max: number) => (typeof value === "string" && value.trim() && value.trim().length <= max && !/[\u0000-\u001f]/.test(value) ? value.trim() : null);

/** Demo checkout: saves the order and returns its ID. Prices are taken from the store, not the browser. */
router.post("/shop/orders", async (req, res): Promise<void> => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const address = (body.address ?? {}) as Record<string, unknown>;
  const name = text(address.name, 60), line = text(address.line, 160), city = text(address.city, 60);
  const pin = typeof body.pin === "string" && isPin(body.pin) ? body.pin : null;
  const payment = typeof body.payment === "string" && PAYMENTS.includes(body.payment) ? body.payment : null;
  const items = Array.isArray(body.items) ? body.items.slice(0, 30) : [];
  if (!name || !line || !city || !pin || !payment || !items.length) {
    res.status(400).json({ error: "Please fill in the address, a 6-digit PIN code and a payment method." });
    return;
  }
  try {
    const sessionId = sessionIdFrom(req);
    const webProducts = sessionId ? normalizeState((await getConversation(sessionId).catch(() => null))?.state).web_products : [];
    const lines: OrderItem[] = [];
    for (const raw of items) {
      const row = (raw ?? {}) as Record<string, unknown>;
      const id = typeof row.id === "string" ? row.id : "";
      const quantity = typeof row.quantity === "number" && Number.isInteger(row.quantity) && row.quantity > 0 && row.quantity <= 10 ? row.quantity : 0;
      // Products found on the web in an earlier chat keep the price shown when they were added.
      const earlierWebProduct = id.startsWith("market-") && text(row.name, 180) && typeof row.price === "number" && row.price > 0 && row.price < 1e7
        ? { name: text(row.name, 180)!, price: Math.round(row.price) } : undefined;
      const product = catalog.find((item) => item.id === id) ?? webProducts.find((item) => item.id === id) ?? earlierWebProduct;
      if (!product || !quantity) {
        res.status(400).json({ error: "An item in the bag is no longer available. Remove it and try again." });
        return;
      }
      lines.push({ id, name: product.name, quantity, price: product.price, colour: text(row.colour, 40) });
    }
    const subtotal = lines.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const coupon = body.coupon === "CAMPUS5" && subtotal >= 3000 ? "CAMPUS5" : null;
    const discount = coupon ? Math.round(subtotal * 0.05) : 0;
    const order = {
      id: await newOrderId(), status: "Confirmed" as const, placedAt: new Date().toISOString(), items: lines,
      total: subtotal - discount, pin, payment, delivery: deliveryEstimate(pin).label,
    };
    await saveOrder({ ...order, sessionId, address: { name, line, city }, coupon });
    res.status(201).json({ ...order, discount });
  } catch (error) {
    req.log.error({ error }, "Demo order failed");
    res.status(500).json({ error: "The order couldn’t be placed. Please try again." });
  }
});

router.get("/shop/orders/:id", async (req, res): Promise<void> => {
  if (!/^CH-?\d{6}$/i.test(req.params.id)) {
    res.status(400).json({ error: "Order IDs look like CH-240117." });
    return;
  }
  try {
    const order = await findOrder(req.params.id);
    if (!order) {
      res.status(404).json({ error: "No order with that ID." });
      return;
    }
    res.json(order);
  } catch (error) {
    req.log.error({ error }, "Order lookup failed");
    res.status(500).json({ error: "The order could not be loaded." });
  }
});

router.post("/shop/returns", async (req, res): Promise<void> => {
  const orderId = typeof req.body?.orderId === "string" ? req.body.orderId : "";
  if (!/^CH-?\d{6}$/i.test(orderId)) {
    res.status(400).json({ error: "Order IDs look like CH-240117." });
    return;
  }
  try {
    const result = await requestReturn(orderId);
    if (!result) {
      res.status(404).json({ error: "No order with that ID." });
      return;
    }
    res.json(result);
  } catch (error) {
    req.log.error({ error }, "Return request failed");
    res.status(500).json({ error: "The return could not be requested." });
  }
});

router.get("/shop/exchange", (req, res): void => {
  const model = typeof req.query.model === "string" ? req.query.model.trim() : "";
  if (model.length < 2 || model.length > 120) {
    res.status(400).json({ error: "Tell us the old device's model." });
    return;
  }
  res.json(exchangeEstimate(model));
});

/** Admin: look up real ratings, review counts, colours and MRP for the catalog on the web (uses the OpenAI key). */
router.get("/shop/admin/enrichment", requireAdmin, (_req, res): void => {
  res.json({ ...enrichmentStatus(), catalogSize: catalog.length });
});

router.post("/shop/admin/enrichment", requireAdmin, (req, res): void => {
  try {
    const started = startEnrichment(catalog, req.body?.refresh === true);
    res.status(started ? 202 : 409).json({ started, ...enrichmentStatus(), catalogSize: catalog.length });
  } catch (error) {
    res.status(502).json({ error: String((error as Error).message ?? error) });
  }
});

export default router;
