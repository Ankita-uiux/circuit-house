#!/usr/bin/env bash
# Build steps for hosting on Render (see render.yaml).
# Database tables are created by the server itself when it starts
# (artifacts/api-server/src/lib/ensure-schema.ts), so the build needs no database.
set -euo pipefail

# Render's system folders are read-only, so install pnpm inside the project.
TOOLS_DIR="$PWD/.build-tools"
npm install --prefix "$TOOLS_DIR" --no-save --no-audit --no-fund pnpm@10.34.6
export PATH="$TOOLS_DIR/node_modules/.bin:$PATH"
pnpm --version

pnpm install --frozen-lockfile

# The storefront build reads PORT and BASE_PATH; on Render it is served from "/".
PORT=10000 BASE_PATH=/ NODE_ENV=production pnpm --filter @workspace/circuit-house run build
pnpm --filter @workspace/api-server run build
