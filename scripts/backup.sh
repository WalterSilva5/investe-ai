#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"
CONTAINER="${PG_CONTAINER:-wsi-invest-postgres}"
DB_USER="${PG_USER:-wsi}"
DB_NAME="${PG_DB:-wsi_invest}"

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d_%H%M%S)"
FILE="$BACKUP_DIR/wsi_invest_$STAMP.sql.gz"

docker exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" | gzip > "$FILE"

# Retenção: 7 dias
find "$BACKUP_DIR" -name 'wsi_invest_*.sql.gz' -mtime +7 -delete

echo "backup: $FILE"
