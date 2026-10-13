import type { CatalogProduct } from "../data/catalog";
import { logger } from "./logger";

/**
 * Official product photos from Icecat's open catalogue (https://icecat.biz).
 *
 * When the server starts it asks Icecat's Live JSON API for each catalog
 * product that has an `icecat` product code, and remembers the main image URL.
 * The storefront then loads that image straight from Icecat's image servers.
 * Products without a match keep their brand tile.
 *
 * Settings (optional, as environment variables):
 * - ICECAT_USERNAME: your Icecat username. Defaults to Icecat's public
 *   open-catalogue user, which covers sponsoring brands.
 * - ICECAT_API_URL: override the API address (used for local testing).
 * - ICECAT_DISABLED=1: turn the lookup off.
 */

const API_URL = process.env.ICECAT_API_URL ?? "https://live.icecat.biz/api/";
const USERNAME = process.env.ICECAT_USERNAME || "openIcecat-live";
const TIMEOUT_MS = 10_000;
const REFRESH_MS = 24 * 60 * 60 * 1000;

const images = new Map<string, string>();

type IcecatImage = { HighPic?: unknown; Pic500x500?: unknown; LowPic?: unknown };
type IcecatResponse = { msg?: unknown; Message?: unknown; data?: { Image?: IcecatImage } };

/** Accept only https image URLs on Icecat's own domain. */
function cleanImageUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  try {
    const url = new URL(value.startsWith("//") ? `https:${value}` : value);
    if (url.protocol === "http:") url.protocol = "https:";
    if (url.protocol !== "https:") return null;
    if (url.hostname !== "icecat.biz" && !url.hostname.endsWith(".icecat.biz")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Picks the best main image from an Icecat Live API response. Exported for tests. */
export function pickIcecatImage(body: unknown): string | null {
  const image = (body as IcecatResponse | null)?.data?.Image;
  if (!image) return null;
  return cleanImageUrl(image.Pic500x500) ?? cleanImageUrl(image.HighPic) ?? cleanImageUrl(image.LowPic);
}

async function lookup(product: CatalogProduct): Promise<string | null> {
  if (!product.icecat) return null;
  const url = new URL(API_URL);
  url.searchParams.set("UserName", USERNAME);
  url.searchParams.set("Language", "en");
  url.searchParams.set("Brand", product.icecat.brand);
  url.searchParams.set("ProductCode", product.icecat.productCode);
  url.searchParams.set("Content", "Image");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const reason = (body as IcecatResponse | null)?.Message ?? (body as IcecatResponse | null)?.msg ?? response.statusText;
      logger.info({ product: product.id, status: response.status, reason }, "Icecat: no photo for product");
      return null;
    }
    const image = pickIcecatImage(body);
    if (!image) logger.info({ product: product.id }, "Icecat: product found but it has no usable image");
    return image;
  } catch (error) {
    logger.warn({ product: product.id, error: String(error) }, "Icecat: lookup failed");
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function refresh(catalog: CatalogProduct[]) {
  const candidates = catalog.filter((product) => product.icecat);
  const results = await Promise.all(candidates.map(async (product) => [product.id, await lookup(product)] as const));
  let found = 0;
  for (const [id, image] of results) {
    if (image) {
      images.set(id, image);
      found += 1;
    }
  }
  logger.info({ found, checked: candidates.length }, `Icecat: photos found for ${found} of ${candidates.length} products`);
}

/** Starts the background lookup. Never throws; the store works without photos. */
export function startIcecatImageLookup(catalog: CatalogProduct[]) {
  if (process.env.ICECAT_DISABLED === "1") return;
  void refresh(catalog);
  setInterval(() => void refresh(catalog), REFRESH_MS).unref();
}

/** The product with its Icecat photo filled in, when one was found. */
export function withIcecatImage<T extends { id: string; image: string | null }>(product: T): T {
  if (product.image) return product;
  const image = images.get(product.id);
  return image ? { ...product, image } : product;
}
