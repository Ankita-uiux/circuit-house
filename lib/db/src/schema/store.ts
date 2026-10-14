import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Demo store data. Mirrored by artifacts/api-server/src/lib/ensure-schema.ts — keep in sync.
 */

/** Orders placed through the demo checkout. Nothing is charged or shipped. */
export const demoOrdersTable = pgTable("demo_orders", {
  id: text("id").primaryKey(),
  sessionId: text("session_id"),
  status: text("status").notNull(),
  items: jsonb("items").notNull(),
  total: integer("total").notNull(),
  pin: text("pin"),
  payment: text("payment").notNull(),
  delivery: text("delivery"),
  address: jsonb("address"),
  coupon: text("coupon"),
  returnId: text("return_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Ratings, review counts, colours and MRP looked up on the web for catalog products (admin-triggered). */
export const productEnrichmentTable = pgTable("product_enrichment", {
  productId: text("product_id").primaryKey(),
  data: jsonb("data").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
});
