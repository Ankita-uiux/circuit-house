#!/usr/bin/env bash
# Build steps for hosting on Render (see render.yaml).
# Needs DATABASE_URL to be set so the database tables can be created/updated.
set -euo pipefail

# Render's system folders are read-only, so install pnpm inside the project.
TOOLS_DIR="$PWD/.build-tools"
npm install --prefix "$TOOLS_DIR" --no-save --no-audit --no-fund pnpm@10.34.6
export PATH="$TOOLS_DIR/node_modules/.bin:$PATH"
pnpm --version

pnpm install --frozen-lockfile

# Create or update the database tables (adds new columns; never drops data).
pnpm --filter @workspace/db run push

# The storefront build reads PORT and BASE_PATH; on Render it is served from "/".
PORT=10000 BASE_PATH=/ NODE_ENV=production pnpm --filter @workspace/circuit-house run build
pnpm --filter @workspace/api-server run build
