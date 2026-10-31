#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "▶ banco SQLite (back/prisma/dev.db) — sem servidor externo"

echo "▶ API (porta 3000, em background → /tmp/wsi-api.log)"
cd back
nohup node dist/main > /tmp/wsi-api.log 2>&1 &
cd "$ROOT"

echo "▶ frontend (porta 4200)"
cd front
npm start -- --host 0.0.0.0
