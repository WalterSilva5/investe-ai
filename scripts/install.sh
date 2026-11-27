#!/usr/bin/env bash
# Instalação fácil do wsi-invest-ai: dependências, banco, seed e build.
# Uso: ./scripts/install.sh [--seed]   (idempotente — pode rodar de novo)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> wsi-invest-ai: instalação"

# 1) Pré-requisitos
if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js não encontrado. Instale Node 20+: https://nodejs.org" >&2
  exit 1
fi
NODE_MAJOR="$(node -v | sed 's/v\([0-9]*\).*/\1/')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "⚠️  Node $(node -v) — recomendado 20+. Continuando mesmo assim."
fi

# 2) Variáveis de ambiente
if [ ! -f "$ROOT/back/.env" ]; then
  cp "$ROOT/back/.env.example" "$ROOT/back/.env"
  echo "==> back/.env criado a partir do .env.example"
  echo "    Configure sua OPENCODE_API_KEY (ou outro provedor de IA) antes de usar o chat."
else
  echo "==> back/.env já existe — mantido."
fi

# 3) Dependências
echo "==> Instalando dependências do back..."
(cd "$ROOT/back" && npm install --no-fund --no-audit --silent) || true
echo "==> Instalando dependências do front..."
(cd "$ROOT/front" && npm install --no-fund --no-audit --silent) || true

# 4) Banco (SQLite em arquivo — sem Docker)
echo "==> Sincronizando banco (prisma db push)..."
(cd "$ROOT/back" && npx prisma db push --skip-generate >/dev/null)
(cd "$ROOT/back" && npx prisma generate >/dev/null)

# 5) Seed (usuários demo) — opcional, padrão sim
if [ "${1:-}" != "--no-seed" ]; then
  echo "==> Seed (admin@wsi.local / demo@wsi.local)..."
  (cd "$ROOT/back" && npm run seed >/dev/null) || echo "    seed falhou ou já aplicado — seguindo."
fi

# 6) Build do back
echo "==> Compilando o back..."
(cd "$ROOT/back" && npm run build --silent >/dev/null)

echo
echo "✅ Instalação concluída."
echo "   Para subir:   ./scripts/up.sh"
echo "   Web:  http://localhost:4200   API: http://localhost:3000/api   Docs: http://localhost:3000/api/docs"
