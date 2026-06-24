#!/bin/bash
# Starts the E2E dev server with an isolated D1 database.
# Uses wrangler d1 migrations apply (via database_name: "todai-league").
# Usage: ./scripts/start-e2e-server.sh

set -e

E2E_DIR=".wrangler/e2e-state"

echo "[e2e-server] Building..."
pnpm build

echo "[e2e-server] Resetting E2E DB..."
rm -rf "$E2E_DIR"

echo "[e2e-server] Applying Drizzle migrations to local D1..."
CI=true npx wrangler d1 migrations apply todai-league --local --persist-to "$E2E_DIR"

echo "[e2e-server] Starting server on port 4173..."
exec npx wrangler dev --port 4173 --persist-to "$E2E_DIR"
