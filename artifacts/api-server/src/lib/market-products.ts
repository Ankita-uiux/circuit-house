import { createHash } from 'node:crypto';
import type { CatalogProduct } from '../data/catalog';
import { sourceUrl, type MarketResult } from './market-search';

const CATEGORIES = new Set(['Phones','Laptops','Tablets','Audio','Wearables','Accessories','Cameras','Gaming','TVs']);
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export type MarketProduct = CatalogProduct & { origin: 'market' };

/** Accept only exact cited listings with a price quote actually present in research. */
export function marketProductFromEvidence(input: unknown, market: MarketResult): MarketProduct | null {
  if (!input || typeof input !== 'object' || market.status !== 'used' || !market.checkedAt) return null;
  const p = input as Record<string, unknown>;
  if (typeof p.name !== 'string' || !p.name.trim() || p.name.length > 180 || typeof p.brand !== 'string' || !p.brand.trim() || p.brand.length > 80 || typeof p.category !== 'string' || !CATEGORIES.has(p.category)) return null;
  if (typeof p.sourceIndex !== 'number' || !Number.isInteger(p.sourceIndex)) return null;
  const source = market.sources[p.sourceIndex-1];
  if (!source || !sourceUrl(source.url)) return null;
  if (typeof p.priceQuote !== 'string' || !market.evidence.includes(p.priceQuote)) return null;
  const quoted = p.priceQuote.match(/(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/i);
  const price = quoted ? Number(quoted[1].replaceAll(',','')) : NaN;
  if (!Number.isFinite(price) || price <= 0 || price > 10_000_000 || p.priceInr !== price) return null;
  if (!normalize(source.title + ' ' + market.evidence).includes(normalize(p.name))) return null;
  if (!Array.isArray(p.specs) || !p.specs.every(s => typeof s === 'string' && s.length <= 200) || typeof p.description !== 'string') return null;
  const name = p.name.trim();
  return {
    id: 'market-' + createHash('sha256').update(source.url + '\n' + normalize(name)).digest('hex').slice(0,20),
    name, brand: p.brand.trim(), category: p.category as CatalogProduct['category'], price,
    description: p.description.slice(0,400), specs: p.specs.slice(0,4) as string[],
    image: null, tags: [p.brand.toLowerCase(),p.category.toLowerCase(),'web listing'], badge: 'Web listing', origin: 'market',
    priceSource: { label: new URL(source.url).hostname.replace(/^www\./,''), url: source.url,
      asOf: new Intl.DateTimeFormat('en-IN',{ dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata' }).format(new Date(market.checkedAt)) },
  };
}

function publicImageUrl(value: string, page: string): string | null {
  try {
    const url = new URL(value.replaceAll('&amp;','&'),page);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    const host = url.hostname;
    // Product-page metadata supplies the URL; no model-generated image URLs.
    const allowed = ['cdn.shopify.com','shopatsc.com','portronics.com','djiindiashop.com','insta360india.com','m.media-amazon.com','images-na.ssl-images-amazon.com','rukmini1.flixcart.com','rukminim2.flixcart.com','store.storeimages.cdn-apple.com','images.samsung.com','image01-in.oneplus.net','cdn.jiostore.online','media-ik.croma.com','i02.appmifile.com','res.goprepare.com','gopro.com','dji.com','insta360.com'];
    return allowed.some(domain => host === domain || host.endsWith('.'+domain)) ? url.href : null;
  } catch { return null; }
}

/** Best-effort photo metadata. Blocked retailer pages keep the normal fallback tile. */
export async function marketProductPhoto(page: string): Promise<string | null> {
  if (!sourceUrl(page)) return null;
  try {
    const response = await fetch(page, { redirect:'manual',signal:AbortSignal.timeout(5000),headers:{Accept:'text/html'} });
    if (!response.ok) return null;
    const reader = response.body?.getReader();
    if (!reader) return null;
    let html = '', bytes = 0;
    const decoder = new TextDecoder();
    try {
      while (true) {
        const {value,done} = await reader.read();
        if (done) break;
        bytes += value.length;
        if (bytes > 2_000_000) break;
        html += decoder.decode(value,{stream:true});
        if (html.includes('</head>')) break;
      }
    } finally { await reader.cancel(); }
    for (const tag of html.match(/<meta\b[^>]+>/gi) ?? []) {
      if (!/(?:property|name)=["'](?:og:image|twitter:image)["']/i.test(tag)) continue;
      const value = tag.match(/content=["']([^"']+)["']/i)?.[1];
      if (value) { const image = publicImageUrl(value,page); if (image) return image; }
    }
  } catch { /* Keep the normal category fallback. */ }
  return null;
}
