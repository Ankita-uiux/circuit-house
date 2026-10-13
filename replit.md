# Circuit House

A demo Indian electronics store (class project) with **Ask Circuit**, an AI shopping copilot whose behaviour is configured from research with college students. The store is used for moderated user testing: chats are saved, and facilitators log "disruption cards" during sessions.

> **Read this first if you are an AI agent picking up this project.** It summarises all work done so far (Oct 2026), how the pieces fit, and the rules the owner set.

## User preferences (follow these)

- **Never push to GitHub without the owner's explicit OK.** Show what would go up (commits/files) and wait for "push".
- Work only in the owner's repo **`Ankita-uiux/circuit-house`** (branch `main`). The original teammate repo `akshn18/Electronics-Shop-with-Shopping-Assistant` must **not** be changed or pushed to.
- Prices are in **Indian rupees**, formatted `₹1,19,900` (en-IN). Never use dollars.
- **No invented data:** no fake ratings/reviews, discounts, bank offers or stock claims. Prices are *reference prices* with a source link and date.
- The UI may follow **Croma's layout and shopping flow**, but must **not** copy Croma's logo, name or branding. Circuit House has its own logo (teal rounded square with a "C" mark, wordmark "circuit**house**").
- Use only images we're allowed to use (Unsplash free photos with credit, Icecat open-catalogue images, or drawn SVG art). No retailer/brand product photos.
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
| Storefront (all store UI, chat panel, facilitator bar) | `artifacts/circuit-house/src/App.tsx` |
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
- **Icecat images** are looked up at runtime on Render by exact manufacturer code (`icecat: {brand, productCode}` on 5 products); only `https://*.icecat.biz` URLs are accepted; misses keep the brand tile.
- **Chat logging never blocks the chat**; session id is sent in the `x-chat-session` header (stored in sessionStorage).
- Admin password is sent as `x-admin-password`; it is never logged.

## Open items / next steps

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
