#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# self-maintenance.sh — degrau L6: auto-manutenção de código (OpenCode CLI)
#
# O que faz:
#   1. Cria um worktree git isolado (.self-maintenance-<data>, branch
#      self-maintenance/<data>) — o repo principal nunca é alterado.
#   2. No worktree: instala dependências, roda testes e builds (back + front).
#   3. Se algo falhar, chama o OpenCode CLI para diagnosticar e corrigir o
#      mínimo necessário, DENTRO do worktree, respeitando guardrails rígidos.
#   4. Gera relatório (.self-maintenance-<data>/MAINTENANCE-REPORT.md) com o
#      comando para abrir PR — mas NUNCA faz push, merge ou commit em main.
#
# Guardrails (rígidos, não negociáveis):
#   - ALLOWED_PATHS abaixo é a única superfície que o OpenCode pode alterar.
#   - Nunca tocar back/prisma/migrations, .env*, auth, segredos.
#   - Nunca push em main, nunca auto-merge, nunca commit automático.
#   - Não sobe servidores (npm start etc.).
#   - A revisão do diff e o merge são sempre HUMANOS.
# =============================================================================

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DATE="$(date +%Y%m%d)"
STAMP="$(date '+%Y-%m-%d %H:%M:%S')"
WORKTREE="$ROOT/.self-maintenance-$DATE"
BRANCH="self-maintenance/$DATE"
REPORT="$WORKTREE/MAINTENANCE-REPORT.md"
LOG_DIR="/tmp/self-maintenance-$DATE"

# Superfície permitida para correções do OpenCode.
ALLOWED_PATHS="back/src front/src docs scripts"

mkdir -p "$LOG_DIR"

echo "▶ L6 auto-manutenção — $(date '+%Y-%m-%d %H:%M')"

# -----------------------------------------------------------------------------
# Worktree isolado (se a branch do dia já existir, reaproveita)
# -----------------------------------------------------------------------------
if [ -d "$WORKTREE" ]; then
  echo "▶ worktree do dia já existe, reaproveitando: $WORKTREE"
else
  if git rev-parse --verify "$BRANCH" >/dev/null 2>&1; then
    echo "▶ branch $BRANCH já existe, reaproveitando"
    git worktree add "$WORKTREE" "$BRANCH"
  else
    echo "▶ criando worktree: $WORKTREE (branch $BRANCH)"
    git worktree add "$WORKTREE" -b "$BRANCH"
  fi
fi

# O banco SQLite local (dev.db) não é versionado; copia a cópia local para os
# testes rodarem no worktree (é uma cópia descartável, nunca migração).
if [ -f "$ROOT/back/prisma/dev.db" ] && [ ! -f "$WORKTREE/back/prisma/dev.db" ]; then
  cp "$ROOT/back/prisma/dev.db" "$WORKTREE/back/prisma/dev.db"
fi

BACK_STATUS="ok"
FRONT_STATUS="ok"
DIAGNOSED="no"

# -----------------------------------------------------------------------------
# Etapas do worktree
# -----------------------------------------------------------------------------
back_deps() {
  if (cd "$WORKTREE/back" && npm ci --prefer-offline --no-audit --no-fund) \
      >"$LOG_DIR/back-deps.log" 2>&1; then
    return 0
  fi
  echo "  npm ci falhou → tentando npm install"
  (cd "$WORKTREE/back" && npm install --no-audit --no-fund) \
    >"$LOG_DIR/back-deps.log" 2>&1
}

# Gera o client Prisma (não toca em migrations nem no banco).
back_prisma_client() {
  (cd "$WORKTREE/back" && npx prisma generate) >"$LOG_DIR/back-prisma-client.log" 2>&1
}

back_test() {
  (cd "$WORKTREE/back" && npm test) >"$LOG_DIR/back-test.log" 2>&1
}

back_build() {
  (cd "$WORKTREE/back" && npm run build) >"$LOG_DIR/back-build.log" 2>&1
}

front_deps() {
  if (cd "$WORKTREE/front" && npm ci --prefer-offline --no-audit --no-fund) \
      >"$LOG_DIR/front-deps.log" 2>&1; then
    return 0
  fi
  echo "  npm ci falhou → tentando npm install"
  (cd "$WORKTREE/front" && npm install --no-audit --no-fund) \
    >"$LOG_DIR/front-deps.log" 2>&1
}

front_build() {
  (cd "$WORKTREE/front" && npm run build) >"$LOG_DIR/front-build.log" 2>&1
}

tail_log() {
  # Últimas linhas de um log, para incluir no diagnóstico/relatório.
  tail -n 80 "$1" 2>/dev/null || true
}

echo "▶ back: dependências"
if ! back_deps; then
  BACK_STATUS="falha nas dependências"
fi

if [ "$BACK_STATUS" = "ok" ]; then
  echo "▶ back: prisma generate (client)"
  if ! back_prisma_client; then
    BACK_STATUS="falha no prisma generate"
  fi
fi

if [ "$BACK_STATUS" = "ok" ]; then
  echo "▶ back: npm test (log: $LOG_DIR/back-test.log)"
  if ! back_test; then
    BACK_STATUS="falha nos testes"
    echo "  ✖ testes do back falharam"
  fi
fi

if [ "$BACK_STATUS" = "ok" ]; then
  echo "▶ back: npm run build"
  if ! back_build; then
    BACK_STATUS="falha no build"
    echo "  ✖ build do back falhou"
  fi
fi

echo "▶ front: dependências"
if ! front_deps; then
  FRONT_STATUS="falha nas dependências"
fi

if [ "$FRONT_STATUS" = "ok" ]; then
  echo "▶ front: npm run build"
  if ! front_build; then
    FRONT_STATUS="falha no build"
    echo "  ✖ build do front falhou"
  fi
fi

# -----------------------------------------------------------------------------
# Diagnóstico e correção via OpenCode CLI (só se algo falhou)
# -----------------------------------------------------------------------------
diagnose_and_fix() {
  if ! command -v opencode >/dev/null 2>&1; then
    echo "✖ OpenCode CLI não encontrado — não é possível diagnosticar automaticamente." >&2
    echo "  Instale com: curl -fsSL https://opencode.ai/install | bash" >&2
    echo "  Depois rode novamente: bash scripts/self-maintenance.sh" >&2
    exit 1
  fi

  local prompt
  prompt="$(cat <<EOF
Você está atuando num WORKTREE git isolado para manutenção automática do projeto wsi-invest-ai.
Testes e/ou build falharam. Diagnostique a causa raiz e corrija O MÍNIMO necessário.

Evidências (trechos das saídas):
--- TESTES BACK ---
$(tail_log "$LOG_DIR/back-test.log")
--- BUILD BACK ---
$(tail_log "$LOG_DIR/back-build.log")
--- BUILD FRONT ---
$(tail_log "$LOG_DIR/front-build.log")
--- DEPENDÊNCIAS BACK ---
$(tail_log "$LOG_DIR/back-deps.log")

Regras RÍGIDAS (obrigatórias):
- Só altere arquivos dentro de: $ALLOWED_PATHS.
- PROIBIDO alterar/remover/criar: back/prisma/migrations (qualquer migração), arquivos .env*,
  código/contratos de autenticação (auth), segredos ou chaves.
- PROIBIDO fazer commit, push, merge ou mudar de branch. Apenas edite arquivos no working tree.
- PROIBIDO alterar package.json para "consertar" dependências downgradeando/upgradando sem motivo claro.
- PROIBIDO apagar testes para fazer passarem; se o teste estiver certo, o código é que deve mudar.
- Não inicie servidores (npm start / ng serve).
Após corrigir, rode: cd back && npm test && npm run build, e depois cd ../front && npm run build.
Reporte ao final: causa raiz, arquivos alterados e resultado dos comandos.
EOF
)"

  echo "▶ chamando OpenCode CLI para diagnosticar e corrigir no worktree"
  if (cd "$WORKTREE" && opencode run "$prompt") >>"$LOG_DIR/opencode-diag.log" 2>&1; then
    echo "  OpenCode concluiu (log: $LOG_DIR/opencode-diag.log)"
  else
    echo "  OpenCode terminou com erro (log: $LOG_DIR/opencode-diag.log)"
  fi
  DIAGNOSED="yes"
}

if [ "$BACK_STATUS" != "ok" ] || [ "$FRONT_STATUS" != "ok" ]; then
  diagnose_and_fix

  # Re-executa as etapas que falharam (uma única tentativa pós-correção).
  if [ "$BACK_STATUS" != "ok" ]; then
    echo "▶ revalidando back após correção"
    if back_deps && back_prisma_client && back_test && back_build; then
      BACK_STATUS="ok (corrigido pelo OpenCode)"
    else
      BACK_STATUS="AINDA FALHANDO após correção"
    fi
  fi
  if [ "$FRONT_STATUS" != "ok" ]; then
    echo "▶ revalidando front após correção"
    if front_deps && front_build; then
      FRONT_STATUS="ok (corrigido pelo OpenCode)"
    else
      FRONT_STATUS="AINDA FALHANDO após correção"
    fi
  fi
fi

# -----------------------------------------------------------------------------
# Relatório (dentro do worktree) — sem push, sem merge
# -----------------------------------------------------------------------------
CHANGES="$(cd "$WORKTREE" && git status --short || true)"
FINAL="$BACK_STATUS / $FRONT_STATUS"

cat >"$REPORT" <<EOF
# Relatório de auto-manutenção (L6)

- **Data:** $STAMP
- **Branch:** \`$BRANCH\` (worktree isolado, repo principal intacto)
- **Status back:** $BACK_STATUS
- **Status front:** $FRONT_STATUS
- **Diagnóstico OpenCode:** $DIAGNOSED

## Mudanças no worktree (\`git status --short\`)

\`\`\`
$CHANGES
\`\`\`

## Logs

Em \`/tmp/self-maintenance-$DATE/\` (back-test, back-build, front-build, opencode-diag).

## Próximos passos (manuais, revisão humana)

1. Revisar o diff: \`git -C .self-maintenance-$DATE diff\`
2. Se estiver OK, commitar no worktree e publicar a branch (o script NUNCA faz isso):
   \`git push -u origin $BRANCH\`
3. Abrir o PR normalmente e revisar por uma pessoa antes de qualquer merge.
4. Depois do merge, apagar o worktree e a branch:
   \`git worktree remove .self-maintenance-$DATE\`
   \`git branch -d $BRANCH\`

## Guardrails aplicados

- Correções restritas a: $ALLOWED_PATHS
- Fora do alcance: migrations, .env*, auth/segredos, push em main, auto-merge, commits automáticos.
EOF

echo "▶ relatório: $REPORT"

if [ "$FINAL" != "ok / ok" ]; then
  echo "✖ manutenção terminou com pendências: $FINAL"
  echo "  Revise manualmente: $REPORT"
  exit 1
fi

echo "✔ manutenção concluída: testes e builds verdes em $BRANCH"
echo ""
echo "Próximos passos MANUAIS (o script nunca faz push/merge):"
echo "  1. git -C .self-maintenance-$DATE diff      # revisar o que mudou"
echo "  2. commit + git push -u origin $BRANCH      # se aprovar, abrir PR"
echo "  3. git worktree remove .self-maintenance-$DATE   # após o merge"
