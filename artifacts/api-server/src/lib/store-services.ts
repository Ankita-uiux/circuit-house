import { createHash } from "node:crypto";
import { pool } from "@workspace/db";

/**
 * Demo store services for the class prototype: delivery estimates by PIN code,
 * order lookup, return requests and exchange estimates. All data is demo data;
 * nothing is shipped, refunded or charged.
 */

const IST = "Asia/Kolkata";
const dateFormat = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: IST });

export function hashNumber(value: string) {
  return parseInt(createHash("sha256").update(value).digest("hex").slice(0, 8), 16);
}

function addDays(days: number, from = new Date()) {
  return new Date(from.getTime() + days * 86_400_000);
}

/** Metro PIN prefixes get faster demo delivery. */
const METROS: Array<{ prefix: string; city: string; store: string }> = [
  { prefix: "11", city: "Delhi", store: "Circuit House, Connaught Place" },
  { prefix: "40", city: "Mumbai", store: "Circuit House, Lower Parel" },
  { prefix: "41", city: "Pune", store: "Circuit House, FC Road" },
  { prefix: "56", city: "Bengaluru", store: "Circuit House, Koramangala" },
  { prefix: "60", city: "Chennai", store: "Circuit House, T. Nagar" },
  { prefix: "50", city: "Hyderabad", store: "Circuit House, Banjara Hills" },
  { prefix: "70", city: "Kolkata", store: "Circuit House, Park Street" },
  { prefix: "38", city: "Ahmedabad", store: "Circuit House, CG Road" },
];
export const DEFAULT_STORE = "Circuit House, Koramangala";

export type DeliveryEstimate = {
  pin: string | null;
  city: string | null;
  serviceable: boolean;
  /** e.g. "Arrives by Fri, 16 Oct" */
  label: string;
  days: number;
  pickupStore: string;
  pickupLabel: string;
};

export function isPin(value: unknown): value is string {
  return typeof value === "string" && /^[1-9]\d{5}$/.test(value);
}

export function deliveryEstimate(pin: string | null): DeliveryEstimate {
  if (!pin || !isPin(pin)) {
    const by = dateFormat.format(addDays(3));
    return { pin: null, city: null, serviceable: true, label: `Arrives by ${by}`, days: 3, pickupStore: DEFAULT_STORE, pickupLabel: "Ready within 2 hours" };
  }
  const metro = METROS.find((item) => pin.startsWith(item.prefix));
  const days = metro ? 1 + (hashNumber(pin) % 2) : 3 + (hashNumber(pin) % 3);
  return {
    pin,
    city: metro?.city ?? null,
    serviceable: true,
    label: days === 1 ? `Arrives tomorrow, ${dateFormat.format(addDays(1))}` : `Arrives by ${dateFormat.format(addDays(days))}`,
    days,
    pickupStore: metro?.store ?? DEFAULT_STORE,
    pickupLabel: metro ? "Ready within 2 hours" : "Ready in 2–3 days",
  };
}

/* ---------- Orders (demo checkout writes real rows; a few sample orders exist for testing) ---------- */

export type OrderItem = { id: string; name: string; quantity: number; price: number; colour?: string | null };
export type DemoOrder = {
  id: string;
  status: "Confirmed" | "Packed" | "Shipped" | "Out for delivery" | "Delivered" | "Return requested";
  placedAt: string;
  items: OrderItem[];
  total: number;
  pin: string | null;
  payment: string;
  delivery: string;
  returnId?: string | null;
};

const SAMPLE_ORDERS: DemoOrder[] = [
  { id: "CH-240117", status: "Shipped", placedAt: addDays(-2).toISOString(), items: [{ id: "macbook-neo", name: "MacBook Neo", quantity: 1, price: 69900 }], total: 69900, pin: "560034", payment: "UPI", delivery: `Arrives by ${dateFormat.format(addDays(1))}` },
  { id: "CH-240118", status: "Delivered", placedAt: addDays(-9).toISOString(), items: [{ id: "airpods-pro-3", name: "AirPods Pro 3", quantity: 1, price: 27900 }], total: 27900, pin: "411001", payment: "Card", delivery: `Delivered on ${dateFormat.format(addDays(-6))}` },
  { id: "CH-240119", status: "Out for delivery", placedAt: addDays(-1).toISOString(), items: [{ id: "iphone-17", name: "iPhone 17", quantity: 1, price: 89900 }], total: 89900, pin: "110001", payment: "EMI", delivery: "Arriving today by 9 pm" },
];

export const ORDER_ID = /\bCH-?\d{6}\b/i;
export function normalizeOrderId(value: string) {
  const digits = value.replace(/\D/g, "");
  return `CH-${digits}`;
}

export async function newOrderId() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const id = `CH-${String(300000 + Math.floor(Math.random() * 699999)).padStart(6, "0")}`;
    const { rowCount } = await pool.query(`SELECT 1 FROM demo_orders WHERE id = $1`, [id]);
    if (!rowCount) return id;
  }
  throw new Error("Could not create an order ID.");
}

export async function saveOrder(order: DemoOrder & { sessionId: string | null; address: unknown; coupon: string | null }) {
  await pool.query(
    `INSERT INTO demo_orders (id, session_id, status, items, total, pin, payment, delivery, address, coupon) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [order.id, order.sessionId, order.status, JSON.stringify(order.items), order.total, order.pin, order.payment, order.delivery, JSON.stringify(order.address), order.coupon],
  );
}

export async function findOrder(id: string): Promise<DemoOrder | null> {
  const normalized = normalizeOrderId(id);
  const sample = SAMPLE_ORDERS.find((order) => order.id === normalized);
  if (sample) return sample;
  const { rows } = await pool.query(
    `SELECT id, status, created_at AS "placedAt", items, total, pin, payment, delivery, return_id AS "returnId" FROM demo_orders WHERE id = $1`,
    [normalized],
  );
  if (!rows[0]) return null;
  return { ...rows[0], placedAt: new Date(rows[0].placedAt).toISOString(), total: Number(rows[0].total) };
}

export type ReturnRequest = { orderId: string; returnId: string; eligible: boolean; message: string; pickupBy: string | null };

/** Demo return policy: 7 days from delivery for most items. */
export async function requestReturn(orderId: string): Promise<ReturnRequest | null> {
  const order = await findOrder(orderId);
  if (!order) return null;
  if (order.status !== "Delivered") {
    return { orderId: order.id, returnId: "", eligible: false, pickupBy: null, message: `Order ${order.id} is "${order.status}". Returns open once it is delivered; until then it can be cancelled from the order page.` };
  }
  const returnId = `RET-${order.id.slice(3)}`;
  await pool.query(`UPDATE demo_orders SET status = 'Return requested', return_id = $2 WHERE id = $1`, [order.id, returnId]).catch(() => undefined);
  return { orderId: order.id, returnId, eligible: true, pickupBy: dateFormat.format(addDays(2)), message: "Return request created. A pickup agent will collect the item; the refund goes to the original payment method within 5–7 days of pickup." };
}

export type ExchangeEstimate = { oldModel: string; low: number; high: number; note: string };

/** A rough demo exchange value from the old device's type, brand and age. */
export function exchangeEstimate(oldModel: string): ExchangeEstimate {
  const text = oldModel.toLowerCase();
  const kind = /laptop|macbook|notebook|thinkpad|vivobook|ideapad|pavilion/.test(text) ? "laptop" : /ipad|tab/.test(text) ? "tablet" : /watch/.test(text) ? "watch" : "phone";
  const base = { phone: 9000, laptop: 18000, tablet: 9000, watch: 3000 }[kind];
  const premium = /iphone|macbook/.test(text) ? 2.8 : /ipad|galaxy s|pixel|pro\b|ultra/.test(text) ? 2.2 : /oneplus|samsung|nothing/.test(text) ? 1.3 : 1;
  const year = Number(text.match(/\b(20[12]\d)\b/)?.[1] ?? 0);
  const generation = Number(text.match(/(?:iphone|galaxy s|pixel)\s*(\d{1,2})\b/)?.[1] ?? 0);
  let age = year ? Math.max(0, 2026 - year) : 3;
  if (/iphone/.test(text) && generation) age = Math.max(0, 17 - generation);
  if (/pixel/.test(text) && generation) age = Math.max(0, 10 - generation);
  const value = base * premium * Math.max(0.2, 1 - age * 0.12);
  const low = Math.round((value * 0.8) / 100) * 100;
  const high = Math.round((value * 1.15) / 100) * 100;
  return { oldModel: oldModel.slice(0, 120), low, high, note: "Demo estimate. The final value depends on condition, checked at pickup." };
}

/* ---------- What the chat passes to the model for store-service questions ---------- */

export type StoreServiceContext = {
  order?: DemoOrder | { id: string; found: false };
  returnRequest?: ReturnRequest | null;
  exchange?: ExchangeEstimate;
  delivery?: DeliveryEstimate;
  policies: string[];
};

export const STORE_POLICIES = [
  "Returns: 7 days from delivery for most items (unopened accessories 10 days). Refund to the original payment method in 5–7 days after pickup.",
  "Exchange: trade in an old phone, laptop, tablet or watch when buying a new one; value is a demo estimate confirmed at pickup.",
  "Delivery: free delivery; metro PIN codes usually 1–2 days, others 3–5 days. Store pickup is usually ready within 2 hours in metro cities.",
  "Warranty: standard manufacturer warranty (usually 1 year); Circuit House handles claims at any store.",
  "Order IDs look like CH-240117.",
];

export async function storeServiceContext(message: string, recent: string[], oldModelHint: string | null): Promise<StoreServiceContext> {
  const text = [message, ...recent].join("\n");
  const context: StoreServiceContext = { policies: STORE_POLICIES };
  const orderMatch = message.match(ORDER_ID) ?? text.match(ORDER_ID);
  if (orderMatch) {
    const order = await findOrder(orderMatch[0]);
    context.order = order ?? { id: normalizeOrderId(orderMatch[0]), found: false };
    if (order && /\b(return|refund|send back|wapas)\b/i.test(message)) context.returnRequest = await requestReturn(order.id);
  }
  const pin = message.match(/\b[1-9]\d{5}\b/)?.[0];
  if (pin) context.delivery = deliveryEstimate(pin);
  if (/\b(exchange|trade[- ]?in|old (phone|laptop|mobile|device))\b/i.test(message)) {
    const model = oldModelHint ?? message.replace(/.*?\b(?:exchange|trade[- ]?in)\b\s*(?:my|an?|the)?\s*/i, "").trim();
    if (model && model.length > 2) context.exchange = exchangeEstimate(model);
  }
  return context;
}
