import type { ConversationState } from "./conversation-state";

type Filterable = { category: string; price: number; brand: string };

/**
 * Products the model may show for this turn: the requested category, within
 * budget (or the stretch budget), without excluded brands. Unknown category =
 * no product cards yet.
 */
export function allowedProducts<T extends Filterable>(state: ConversationState, products: T[]): T[] {
  if (!state.category) return [];
  const ceiling = state.budget_stretch ?? state.budget_max;
  const excluded = state.brands_exclude.map((brand) => brand.toLowerCase());
  const inCategory = products.filter((product) =>
    product.category === state.category
    && (ceiling === null || product.price <= ceiling)
    && !excluded.some((brand) => product.brand.toLowerCase().includes(brand) || brand.includes(product.brand.toLowerCase())));
  // Asked-for brands narrow the list only when we actually have them.
  const wanted = state.brands_include.map((brand) => brand.toLowerCase());
  const preferred = wanted.length ? inCategory.filter((product) => wanted.some((brand) => product.brand.toLowerCase().includes(brand))) : [];
  return preferred.length ? preferred : inCategory;
}

/** How far over the main budget a product is (shown as "+₹X over budget"), or null. */
export function overBudgetBy(state: ConversationState, price: number): number | null {
  return state.budget_max !== null && price > state.budget_max ? price - state.budget_max : null;
}

const STORES = [
  "Amazon\\.in", "Amazon India", "Amazon", "Flipkart", "Croma", "Reliance Digital", "Vijay Sales", "Tata CLiQ", "Tata Cliq", "JioMart",
  "Snapdeal", "Poorvika", "Sangeetha Mobiles", "Sangeetha", "Myntra", "Meesho", "Paytm Mall", "Shopsy", "Smartprix", "91mobiles",
];
const STORE = `(?:${STORES.join("|")})(?:'s)?`;

/**
 * Removes other stores' names, links and [n] citations from a reply: web
 * results are a data source only, and every product is sold by Circuit House.
 */
export function sanitizeReply(text: string): string {
  return text
    .replace(/\s?\[\d+(?:\s*,\s*\d+)*\]/g, "")
    .replace(/\(?https?:\/\/\S+\)?/g, "")
    .replace(new RegExp(`\\s*\\b(?:on|at|from|via|in|by)\\s+(?:the\\s+)?${STORE}(?:\\s+(?:store|website|site|app|listing|page|sale))?`, "gi"), "")
    .replace(new RegExp(`\\b${STORE}\\b`, "gi"), "other stores")
    .replace(/\s+(?:and|or|,)\s*([.;!?])/g, "$1")
    .replace(/[ \t]+([,.;!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
