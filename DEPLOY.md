# Hosting Circuit House for free (Render + Neon)

The whole app runs as one free Render web service: the Express API serves both `/api/*` and the built storefront. The database is a free Neon Postgres.

## 1. Create the database (Neon)

1. Sign up at https://neon.com (free plan, no card needed) and create a project.
2. Copy the connection string (it starts with `postgresql://` and ends with `?sslmode=require`).

## 2. Create the web service (Render)

1. Sign up at https://render.com with your GitHub account.
2. Choose **New → Blueprint** and pick this repository. Render reads `render.yaml`.
3. When asked for environment variables, fill in:
   - `DATABASE_URL` — the Neon connection string.
   - `OPENAI_API_KEY` — the OpenAI key that will pay for chat replies.
   - `ADMIN_PASSWORD` — the password for the `/admin` page. Share it only with teammates.
4. Deploy. The first build takes a few minutes. Your store is at `https://<service-name>.onrender.com` and the settings page at `/admin`.

The server creates its database table automatically the first time it starts.

## Things to know

- **Sleeping:** on the free plan the service sleeps after 15 minutes without visitors. The next visit takes about a minute to wake it.
- **OpenAI costs:** every chat message is billed to `OPENAI_API_KEY`. Set a monthly spending limit in your OpenAI account before sharing the link.
- **Admin password:** without `ADMIN_PASSWORD`, anyone can change the assistant settings. With it, the admin page asks for the password and the server refuses changes without it.
- **Updates:** pushing to the repository's `main` branch redeploys automatically.
- **Product photos:** the 54 catalog photos are bundled in `artifacts/circuit-house/public/catalog/` as 800 × 800 WebP files with centered products and consistent margins. Sources are recorded in `scripts/catalog-image-sources.json`. To rebuild assets, install Pillow and run `python scripts/prepare-catalog-images.py --download` from the repository root. This is not required during deployment. Icecat remains a fallback for future products without an assigned image; `ICECAT_DISABLED=1` disables that lookup.

## User testing (saved chats)

- Every Ask Circuit conversation is saved to the database (table `chat_sessions` and `chat_messages`), with the assistant settings in effect when it started.
- **Facilitator mode:** open the store with `?facilitator=1` at the end of the link (for example `https://circuit-house.onrender.com/?facilitator=1`). The chat panel then shows a facilitator bar: type the participant label (P1, P2…), tap a card (01–09) at the moment you hand it over, and use **New participant** (tap twice) before the next person. Use `?facilitator=0` to turn it off on that device.
- **Results:** `/admin` → **Test sessions** lists every session with its cards. Open one to read the transcript with card moments highlighted, or **Download CSV** for a spreadsheet of every message.
