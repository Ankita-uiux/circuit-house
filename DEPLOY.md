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
