/** Shared storefront/assistant matching: model names, multiple terms and INR budgets. */
type SearchableProduct = { name: string; brand: string; category: string; description: string; specs: string[]; tags: string[]; price: number };
export const normalizeSearch = (value: string) => value.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const STOP_WORDS = new Set(['show','me','a','an','the','for','in','with','and','of','please','i','want','need','buy','best','budget','looking','suggest','recommend','some','products','product','options']);

export function searchCatalog<T extends SearchableProduct>(products: T[], query: string): T[] {
  if (!query.trim()) return products;
  let min = 0, max = Infinity;
  const text = query.toLowerCase().replace(/(under|below|less than|up to|upto|above|over|at least)\s*(?:₹|rs\.?\s*|inr\s*)?([\d,]+(?:\.\d+)?)\s*(k|lakh|lac|lakhs)?/g, (_, relation: string, digits: string, unit: string) => {
    const amount = Number(digits.replaceAll(',', '')) * (unit === 'k' ? 1000 : unit ? 100000 : 1);
    if (['above','over','at least'].includes(relation)) min = amount; else max = amount;
    return ' ';
  });
  const terms = normalizeSearch(text).split(' ').filter(t => t && !STOP_WORDS.has(t));
  return products.map(product => {
    const name = normalizeSearch(product.name).replaceAll(' ', '');
    const field = normalizeSearch([product.name,product.brand,product.category,product.description,...product.specs,...product.tags].join(' '));
    const compact = field.replaceAll(' ', '');
    const matches = terms.every(term => field.includes(term) || compact.includes(term));
    const score = terms.reduce((s, term) => s + (name.includes(term) ? 3 : field.includes(term) ? 1 : 0), 0);
    return { product, matches, score };
  }).filter(({ product, matches }) => matches && product.price >= min && product.price <= max)
    .sort((a,b) => b.score-a.score).map(({product}) => product);
}
