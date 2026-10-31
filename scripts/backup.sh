#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_FILE="$ROOT/back/prisma/dev.db"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"

[ -f "$DB_FILE" ] || { echo "banco não encontrado: $DB_FILE" >&2; exit 1; }

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d_%H%M%S)"
FILE="$BACKUP_DIR/wsi_invest_$STAMP.db"

# sqlite3 .backup faz cópia consistente; senão, cp simples.
if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DB_FILE" ".backup '$FILE'"
else
  cp "$DB_FILE" "$FILE"
fi

# Retenção: 7 dias
find "$BACKUP_DIR" -name 'wsi_invest_*.db' -mtime +7 -delete

echo "backup: $FILE"
