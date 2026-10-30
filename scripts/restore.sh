#!/usr/bin/env bash
set -euo pipefail

FILE="${1:?uso: ./scripts/restore.sh backups/wsi_invest_YYYYmmdd_HHMMSS.sql.gz}"
CONTAINER="${PG_CONTAINER:-wsi-invest-postgres}"
DB_USER="${PG_USER:-wsi}"
DB_NAME="${PG_DB:-wsi_invest}"

if [ ! -f "$FILE" ]; then
  echo "arquivo não encontrado: $FILE" >&2
  exit 1
fi

gunzip -c "$FILE" | docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME"
echo "restaurado: $FILE"
