# Circuit House

A demo Indian electronics store (class project) with **Ask Circuit**, an AI shopping copilot whose behaviour is configured from research with college students. The store is used for moderated user testing: chats are saved, and facilitators log "disruption cards" during sessions.

> **Read this first if you are an AI agent picking up this project.** It summarises all work done so far (Oct 2026), how the pieces fit, and the rules the owner set.

## User preferences (follow these)

- **Never push to GitHub without the owner's explicit OK.** Show what would go up (commits/files) and wait for "push".
- Work only in the owner's repo **`Ankita-uiux/circuit-house`** (branch `main`). The original teammate repo `akshn18/Electronics-Shop-with-Shopping-Assistant` must **not** be changed or pushed to.
- Prices are in **Indian rupees**, formatted `₹1,19,900` (en-IN). Never use dollars.
- **No invented ratings or reviews:** star ratings, review counts, colours and MRP come only from the admin-triggered web lookup (`/admin` → Ratings, reviews and colours) and stay empty otherwise. Stock, pickup, delivery, store offers (EMI, CAMPUS5) and orders are clearly demo data for user testing.
- **Never show other stores to shoppers:** web search is a data source only; replies are sanitised of Amazon/Flipkart/Croma names, links and citations, and web-found products are shown as normal Circuit House products.
- **The assistant prompt is the team prompt, edited in `/admin` → "Team prompt"** (stored in `assistant_behavior_settings.team_prompt`; empty = the built-in default `TEAM_PROMPT` in `api-server/src/lib/assistant-behavior.ts`). Paste the dialogue team's new version there; no code change needed. After it, the server always appends `APP_RULES` (fixed: data sources, output fields for cards / options / comparison / cartAddId) and then the empathy + initiative settings. Each chat session stores the prompt it used in `chat_sessions.settings`. Decisions (15 Oct): web-found products stay in (sold as ours); a shopping request instead of a name skips the name; demo low-stock labels stay.
- The UI may follow **Croma's layout and shopping flow**, but must **not** copy Croma's logo, name or branding. Circuit House has its own logo (teal rounded square with a "C" mark, wordmark "circuit**house**").
- The owner approved real product photos for the catalog (13 Oct 2026), with a consistent square white background and centered framing. Source references are recorded in `scripts/catalog-image-sources.json`. Keep the existing Unsplash credits for banner photos.
- Keep explanations simple; the owner is a design student, not a developer.

## Where it runs

| Place | What | Notes |
|---|---|---|
| GitHub | `Ankita-uiux/circuit-house`, branch `main` | Source of truth. |
| **Render** (live) | https://circuit-house.onrender.com | Free web service, auto-deploys on every push to `main` (Blueprint `render.yaml`). Sleeps after 15 min idle; first visit ~50 s. |
| **Neon** | Postgres database | Connection string is Render's `DATABASE_URL`. |
| Replit | Development | Two services: API (`artifacts/api-server`, port 8080, path `/api`) and storefront (`artifacts/circuit-house`, Vite). |

Environment variables (set in Render; set as Replit Secrets for dev):
- `DATABASE_URL` (required) — Postgres.
- `OPENAI_API_KEY` (required for chat) — the owner's key; every chat costs money, so a monthly limit is set on OpenAI.
- `ADMIN_PASSWORD` — locks `/admin`. Without it the admin page is open.
- Optional: `ICECAT_USERNAME`, `ICECAT_DISABLED=1`, `ICECAT_API_URL` (testing).

## Run & operate

- `pnpm --filter @workspace/api-server run dev` — API server
- `pnpm --filter @workspace/circuit-house run dev` — storefront (needs `PORT` and `BASE_PATH`, which Replit sets)
- `pnpm run typecheck` — full typecheck
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API client + Zod after editing `lib/api-spec/openapi.yaml`
- `pnpm --filter @workspace/db run push` — sync Drizzle schema to the dev DB (optional: the server also creates tables itself, see below)
- Render build: `bash scripts/render-build.sh` (installs pnpm inside the project because Render's system folders are read-only, builds storefront + API). Start: `node artifacts/api-server/dist/index.mjs`. In production the API server **also serves the built storefront** (`artifacts/circuit-house/dist/public`), so it's one service.

## Stack

pnpm workspaces · Node 24 · TypeScript 5.9 · Express 5 · PostgreSQL + Drizzle · Zod · Orval codegen · React 19 + Vite + wouter · esbuild · OpenAI (`gpt-5-mini`) for the assistant.

## Where things live

| What | File |
|---|---|
| Product catalog (54 real products, INR, specs, price sources) | `artifacts/api-server/src/data/catalog.ts` |
| Assistant prompt, defaults, empathy stages | `artifacts/api-server/src/lib/assistant-behavior.ts` |
| Chat endpoint (OpenAI call, product picks, logging) | `artifacts/api-server/src/routes/shop.ts` |
| Admin settings API + password check | `routes/assistant-settings.ts`, `lib/admin-auth.ts` |
| Saved chats / test sessions API | `routes/chat-sessions.ts`, `lib/chat-log.ts` |
| Icecat photo lookup | `lib/icecat.ts` |
| Tables created on server start | `lib/ensure-schema.ts` (must mirror Drizzle schema in `lib/db/src/schema/*.ts`) |
| API contract | `lib/api-spec/openapi.yaml` → generated `lib/api-client-react`, `lib/api-zod` |
| Store shell, home page | `artifacts/circuit-house/src/App.tsx` |
| Header / footer, bag drawer, shared product UI (cards, price, rating, stock, stepper) | `src/components/layout.tsx`, `cart-drawer.tsx`, `store-ui.tsx` |
| Bag state (shared by store, chat, checkout) | `src/cart.tsx` |
| Chat: state + server sync, panel, cards/options sheet, extras (thinking, feedback, starters, chips, human card) | `src/chat/chat-context.tsx`, `AssistantPanel.tsx`, `ProductCards.tsx`, `ChatExtras.tsx` |
| Product page, checkout | `src/pages/product.tsx`, `src/pages/checkout.tsx` |
| Design system (tokens, buttons, cards, sheet, PDP, checkout) | `src/ui.css` (+ `chat.css`, `storefront.css`) |
| Conversation state, name parsing, filters, store services, product extras, ratings lookup | `api-server/src/lib/conversation-state.ts`, `participant-name.ts`, `reply-filters.ts`, `store-services.ts`, `product-extras.ts`, `product-enrichment.ts` |
| Orders, delivery, returns, exchange, admin ratings lookup | `api-server/src/routes/store.ts` |
| Store styles (light theme, teal accent, Figtree font) | `artifacts/circuit-house/src/storefront.css` (tokens `--cx-*` on `:root`) |
| Banner illustrations (SVG) | `artifacts/circuit-house/src/banners.tsx` |
| Admin page / Test sessions viewer | `src/pages/admin.tsx`, `src/pages/test-sessions.tsx` |
| Hosting guide | `DEPLOY.md`, `render.yaml`, `scripts/render-build.sh` |

## Product (what exists today)

**Storefront** — Croma-style layout, light theme:
- White sticky header: logo, big search ("What are you looking for?"), delivery pincode picker (saved locally, demo only), cart with count.
- Rotating offer banners (fixed height): *Festive Tech Fest* (real Unsplash photo by Rodion Kutsaiev), *Laptops for every course* (SVG laptop), *5G phones under ₹20,000* (real Unsplash photo by Daniel Romero), *Ask Circuit* (mock chat card). Banner prices are computed from the catalog; fine print says reference prices, Oct 2026. If a photo fails, the SVG art shows.
- Round category shortcuts (Phones, Laptops, Tablets, Audio, Wearables, Accessories).
- Scrolling product rows (laptops, phones under ₹30k, audio, tablets & watches) and an "All products" grid with filter chips, sort, and search across name/brand/specs.
- Product cards: brand, name, two key specs, ₹ price with "Ref. price · date" link to its source, Add to cart (+ toast). No ratings. Brand tile instead of a photo unless Icecat finds one.
- Cart drawer and a demo checkout (no payment).

**Catalog** — 54 real products sold in India: 25 phones (₹15,999–₹1,64,900), 9 laptops (₹51,950–₹1,69,900), 5 tablets, 9 audio, 4 wearables, 2 accessories. Prices from 91mobiles, Smartprix, Apple India and news sites, checked 8–13 Oct 2026 (Apple raised several Indian prices during 2026, so Apple prices are higher than older listings). Each product has `priceSource {label, url, asOf}`.

**Ask Circuit (copilot)** — floating teal button bottom-right opens a right-side panel (full screen on phones). Replies render paragraphs, bullet lists and **bold**; suggested products appear as cards with "Add to bag". The model only recommends catalog IDs (validated server-side), writes ₹ prices, says prices aren't live, and follows fixed formatting rules (short, punctuated, bullets for options, one question at the end).

**Admin (`/admin`, password-protected)**:
1. Persona, tone, conversation goal.
2. Empathy 0–10 + five owner-written **empathy examples** (stages: Practical 0–1, Courteous 2–3, Acknowledging 4–6, Warm 7–8, Deeply attuned 9–10). The current stage is marked in the prompt as calibration.
3. Initiative 0–10.
4. **Test sessions**: list of saved chats (start time, participant, message count, cards), transcript view with per-message timestamps and highlighted card moments, delete, **Download CSV**.

**User testing** — every chat is saved (`chat_sessions`, `chat_messages`), including suggested products, reply time, errors, and a snapshot of the assistant settings at session start. Facilitator mode: open the store with `?facilitator=1` → yellow bar in the chat panel to set a participant label, tap the card handed over (01–09), and start a new participant (tap twice). `?facilitator=0` turns it off. The chat footnote tells visitors chats are saved for a class study.

Test cards: 01 Everything at once · 02 Change your mind · 03 Off-topic · 04 Confused · 05 Wrong information · 06 Vague · 07 Ask for a human · 08 Hinglish and typos · 09 Silence.

## Research behind the copilot

From 5 student interviews + a JTBD list (in the owner's files): students set a fixed budget first (often parents'), choose by the work they'll do (Figma, coding, editing), want to know trade-offs ("what do I give up"), distrust store chatbots and pushy shopkeepers, want plain-language specs, cross-check AI, often write in Hinglish, and know ChatGPT lacks live prices/reviews. Suggested settings given to the owner: persona = independent senior/friend who has done the research; tone = plain, direct, no upsell, Hinglish if the shopper uses it; empathy ≈ 4; initiative ≈ 6; goal = ask use + budget early, max 2–3 options, explain trade-offs, be honest about catalog-only knowledge. (Settings are stored in the DB via `/admin`, not in code.)

## Architecture decisions

- **Tables are created by the server on start** (`ensureSchema`, idempotent `CREATE TABLE / ADD COLUMN IF NOT EXISTS`) because `drizzle-kit push` failed silently on Render. Keep `ensure-schema.ts` and `lib/db/src/schema/*` in sync.
- **One Render service** serves both API and storefront to stay on the free tier.
- **Catalog lives in code** (`catalog.ts`), not the DB, so prices/sources are reviewable in git. The assistant receives brand, specs, INR price and tags.
- **Catalog images** are bundled as local 800 × 800 WebP assets in `artifacts/circuit-house/public/catalog/`. `scripts/prepare-catalog-images.py` rebuilds them from the recorded sources. Icecat remains a fallback for unassigned products with a manufacturer code; misses keep the brand tile.
- **Named test chats** first collect a first name or nickname and save the opening transcript atomically. The name becomes the title; old titles stay unchanged unless manually renamed in admin. Every new conversation gets a distinct session ID, sent in `x-chat-session`. Admin lists all chats in pages of 50 and refreshes every 10 seconds. Logging failures propagate so the UI does not silently report a successful unsaved turn.
- Admin password is sent as `x-admin-password`; it is never logged.

## Chat behaviour (Oct 14 2026 rebuild)

- Name step keeps only the first name; a shopping request sent instead of a name is answered right after the name.
- Per-session state (`chat_sessions.state`): category, budget_max, budget_stretch, use_case, brands_include/exclude, must_haves, items_in_bag, last_discussed, verbosity, mode, plus a cache of web-found products. Updated every turn by a small model call; sent to the main model with the full saved history.
- Category/budget/brand filters run in code before the model; no cards until the category is known; "+₹X over budget" for stretch items.
- Intents: off-topic → one-line guardrail; human → "Our store expert will call you in 10 seconds 📞" card; store-service → demo order/return/exchange/delivery data.
- Chat UI: docked beside the page on wide screens, survives close/refresh, New chat, Reply/quote, smart scrolling, thinking indicator, word-by-word reveal (client side), thumbs up/down + feedback modal (saved as `feedback` rows), starter prompts, Try asking chips, Short/Normal/Detailed switch, Help me choose / I know what I want.
- Sample order IDs for testing: CH-240117, CH-240118, CH-240119. Coupon: CAMPUS5.

## Team flow (15 Oct 2026)

- Greeting asks for the name; then "What are you shopping for today?" with [Laptop] [Phone] [Headphones] [Something else] chips.
- The server computes the stage (1 greeting, 2 slots, 3 search, 4 actions) and missing slots (use → budget → brand) and sends them to the model.
- The model returns options (tappable chips), productNotes (Why / Heads-up per card, first = ⭐ Best fit), comparison (table for "Compare all 3") and cartAddId (adds to the cart when the shopper asks). Chips "Go to cart" and "Talk to store expert" are app actions.
- Fewer than 3 products in budget: the nearest over-budget options are offered with "+₹X over budget".

## Open items / next steps

- After deploying, run `/admin` → **Ratings, reviews and colours** once (uses the OpenAI key, about $1–2).
- Real token streaming from OpenAI is not implemented; replies are revealed word by word after they arrive.

- **Icecat**: on the first live run, 0 of 5 products got photos. Check Render logs for lines starting `Icecat:` to see why (not found vs connection). Product codes may need changing to Icecat's MPNs.
- More products were planned (flagship phones, laptops ₹30k–₹80k, tablets, over-ear headphones, smartwatches, power banks) from Smartprix/91mobiles pages.
- Possibly real photos for the laptop and copilot banners (Unsplash).
- Run a practice test session after each deploy and delete it from Test sessions.

## Gotchas

- Storefront dev/build needs `PORT` and `BASE_PATH` env vars (Replit sets them; Render build sets `PORT=10000 BASE_PATH=/`).
- After editing `openapi.yaml`, run codegen, then `pnpm run typecheck:libs` before typechecking apps.
- Render free tier sleeps; the first request after idle is slow.
- Prices change often — update `price` **and** `priceSource.asOf` together.
- The `/admin` warning banner only shows when no `ADMIN_PASSWORD` is set.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
- Hosting steps: `DEPLOY.md`.
