import type { CatalogProduct } from "../data/catalog";
import { DEFAULT_STORE, deliveryEstimate, hashNumber } from "./store-services";

/**
 * Store details every product card, options sheet and product page needs.
 * Ratings, review counts, colours and MRP come from a web lookup (see
 * product-enrichment.ts) and are left empty when nothing real was found.
 * Stock, pickup, delivery and offers are demo store data for the prototype.
 */

export type Colour = { name: string; hex: string };
export type Enrichment = {
  colours?: string[];
  rating?: number | null;
  reviewCount?: number | null;
  mrp?: number | null;
  images?: string[];
};

export type StoreProduct = CatalogProduct & {
  origin?: "catalog" | "market";
  model: string;
  colours: Colour[];
  rating: number | null;
  reviewCount: number | null;
  mrp: number | null;
  stock: { status: "in_stock" | "low_stock"; label: string; count: number | null };
  pickup: { store: string; label: string };
  delivery: { label: string };
  offers: string[];
  images: string[];
  overBudgetBy?: number | null;
};

const COLOUR_HEX: Array<[RegExp, string]> = [
  [/black|midnight|obsidian|graphite|space|onyx|jet|carbon|night|shadow|dark/i, "#1f2124"],
  [/white|snow|cloud|pearl|ivory|porcelain|chalk/i, "#f4f4f2"],
  [/silver|platinum|titanium|natural|steel|grey|gray|ash|stone/i, "#b9bcc0"],
  [/starlight|cream|beige|sand|desert|champagne|gold/i, "#e6d6b8"],
  [/blue|navy|ocean|sky|sapphire|aqua|teal|cyan|denim|ice/i, "#3f6fb5"],
  [/green|mint|olive|sage|emerald|lime|forest|jade/i, "#4f8a64"],
  [/red|crimson|burgundy|wine|ruby|coral/i, "#b63a3a"],
  [/pink|rose|blush|lavender|lilac/i, "#e6a6be"],
  [/purple|violet|plum|mauve/i, "#7a5aa8"],
  [/orange|amber|sunset|citrus|copper/i, "#e07b39"],
  [/yellow|lemon/i, "#e8cf47"],
  [/brown|bronze|mocha|coffee/i, "#7b5a43"],
];

export function colourHex(name: string) {
  return COLOUR_HEX.find(([pattern]) => pattern.test(name))?.[1] ?? "#9aa0a6";
}

function modelName(product: CatalogProduct) {
  const brand = product.brand.toLowerCase();
  return product.name.toLowerCase().startsWith(brand + " ") ? product.name.slice(product.brand.length + 1) : product.name;
}

function formatInr(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

/** Demo offers from Circuit House itself (not bank or third-party offers). */
function storeOffers(product: CatalogProduct): string[] {
  const offers: string[] = [];
  if (product.price >= 10000) offers.push(`No Cost EMI from ${formatInr(Math.ceil(product.price / 6))}/month for 6 months`);
  if (["Phones", "Laptops", "Tablets", "Wearables"].includes(product.category)) offers.push("Exchange your old device for extra value (estimate at checkout)");
  if (product.price >= 3000) offers.push("Students: extra 5% off with code CAMPUS5");
  offers.push("Free delivery and 7-day returns");
  return offers;
}

export function withStoreDetails<T extends CatalogProduct>(product: T, enrichment?: Enrichment | null, pin: string | null = null): T & StoreProduct {
  const seed = hashNumber(product.id);
  const lowStock = seed % 5 === 0;
  const count = lowStock ? 2 + (seed % 5) : null;
  const delivery = deliveryEstimate(pin);
  const rating = typeof enrichment?.rating === "number" && enrichment.rating >= 1 && enrichment.rating <= 5 ? Math.round(enrichment.rating * 10) / 10 : null;
  const reviewCount = typeof enrichment?.reviewCount === "number" && enrichment.reviewCount > 0 ? Math.round(enrichment.reviewCount) : null;
  const mrp = typeof enrichment?.mrp === "number" && enrichment.mrp > product.price && enrichment.mrp < product.price * 2 ? Math.round(enrichment.mrp) : null;
  const colourNames = [...new Set((enrichment?.colours ?? []).map((name) => name.trim()).filter(Boolean))].slice(0, 6);
  const extraImages = (enrichment?.images ?? []).filter((url) => url && url !== product.image);
  const images = [product.image, ...extraImages].filter((url): url is string => !!url);
  let badge = product.badge;
  if (!badge && rating !== null && rating >= 4.4 && (reviewCount ?? 0) >= 500) badge = "Highly rated";
  if (!badge && (reviewCount ?? 0) >= 10000) badge = "Bestseller";
  return {
    ...product,
    badge,
    model: modelName(product),
    colours: colourNames.map((name) => ({ name, hex: colourHex(name) })),
    rating,
    reviewCount: rating === null ? null : reviewCount,
    mrp,
    stock: lowStock ? { status: "low_stock", label: `Only ${count} left`, count } : { status: "in_stock", label: "In stock", count: null },
    pickup: { store: delivery.pickupStore ?? DEFAULT_STORE, label: delivery.pickupLabel },
    delivery: { label: delivery.label },
    offers: storeOffers(product),
    // At least two images: a second view when the web lookup found one, otherwise the same photo
    // (the storefront shows it as a close-up on hover).
    images: images.length >= 2 ? images.slice(0, 4) : images.length === 1 ? [images[0], images[0]] : [],
  };
}
