import { Router, type IRouter } from "express";
import { requireAdmin } from "../lib/admin-auth";
import { catalog } from "../data/catalog";
import { enrichmentStatus, startEnrichment } from "../lib/product-enrichment";
import { deliveryEstimate, exchangeEstimate, findOrder, isPin, requestReturn } from "../lib/store-services";

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
