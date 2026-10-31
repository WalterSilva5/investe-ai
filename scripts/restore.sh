#!/usr/bin/env bash
set -euo pipefail

FILE="${1:?uso: ./scripts/restore.sh backups/wsi_invest_YYYYmmdd_HHMMSS.db}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_FILE="$ROOT/back/prisma/dev.db"

[ -f "$FILE" ] || { echo "arquivo não encontrado: $FILE" >&2; exit 1; }

cp "$FILE" "$DB_FILE"
echo "restaurado: $FILE"
