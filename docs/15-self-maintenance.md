# 15. Auto-manutenção de código (degrau L6)

## O que é

É a camada acima do **auto-ajuste de prompts (L5)**: enquanto o L5 melhora o
que o agente *diz* (prompts avaliados contra o baseline), o L6 cuida da
*saúde do código* — testes, builds e correções mínimas — rodando o
**OpenCode CLI** localmente, dentro de um **worktree git isolado**, com
guardrails rígidos.

A premissa é conservadora: a máquina pode *propor* correções, mas quem
**revisa, commita e mergear é sempre uma pessoa**.

## O que o script faz (passo a passo)

Script: `scripts/self-maintenance.sh` (nunca sobe servidores; nunca faz
push/merge).

1. **Worktree isolado** — cria `.self-maintenance-<data>/` na branch
   `self-maintenance/<data>` (`git worktree add`). Se a branch do dia já
   existir, reaproveita. O repo principal e a working copy não são tocados.
   O `dev.db` local é copiado para o worktree (cópia descartável; o banco
   não é versionado).
2. **Back** — `npm ci --prefer-offline` (se falhar, `npm install`),
   `npx prisma generate` (só o client; não toca em migrations), `npm test`
   (saída em `/tmp/self-maintenance-<data>/back-test.log`) e
   `npm run build`.
3. **Front** — `npm ci --prefer-offline` e `npm run build`.
4. **Se algo falhar** — chama o OpenCode CLI no diretório do worktree
   (`opencode run "<prompt de diagnóstico>"`) com as evidências dos logs e
   o pedido de **correção mínima**; depois revalida as etapas que falharam
   (uma única tentativa pós-correção).
5. **Relatório** — gera `.self-maintenance-<data>/MAINTENANCE-REPORT.md`
   com data, status de testes/builds, mudanças (`git status --short`) e o
   comando para abrir PR — **sem executá-lo**.

## Guardrails

- **Allowlist de paths**: `back/src front/src docs scripts` — é a única
  superfície que o OpenCode pode alterar.
- **Fora do alcance (proibido no prompt do OpenCode e no script):**
  - `back/prisma/migrations` (criar/alterar/apagar migrações);
  - arquivos `.env*` e segredos/chaves;
  - código e contratos de **autenticação**;
  - commit, push, merge, troca de branch ou commit em `main`;
  - apagar testes para "fazer passar" (se o teste está certo, muda o código);
  - iniciar servidores (`npm start`, `ng serve`).
- **Sem push automático**: o script apenas imprime o comando
  `git push -u origin self-maintenance/<data>`; a execução é manual.
- **Sem auto-merge**: todo PR passa por revisão humana antes do merge.
- **Log centralizado**: `/tmp/self-maintenance-<data>/` (back-test,
  back-build, front-build, opencode-diag).

## Agendamento (cron)

O ciclo é **manual ou agendado** — por padrão semanal, fora do horário útil:

```cron
# sábado, 04:00 — manutenção semanal do código
0 4 * * 6  cd /caminho/do/wsi-invest-ai && bash scripts/self-maintenance.sh >> /tmp/self-maintenance-cron.log 2>&1
```

O relatório da última execução fica em
`.self-maintenance-<data>/MAINTENANCE-REPORT.md`.

## Revisar, abrir PR e limpar o worktree

```bash
# 1. Revisar o que mudou
git -C .self-maintenance-<data> diff

# 2. Se aprovado: commitar no worktree e publicar (passos manuais)
git -C .self-maintenance-<data> add -A
git -C .self-maintenance-<data> commit -m "fix: manutenção automática <data>"
git push -u origin self-maintenance/<data>
#    → abrir o PR na interface do GitHub e revisar antes do merge

# 3. Após o merge, limpar
git worktree remove .self-maintenance-<data>
git branch -d self-maintenance/<data>
```

## Como fica o fluxo com o "Aprendizado" (L5)

Os dois degraus se alimentam em ciclos diferentes:

- O **L5** (auto-ajuste de prompts) continua dono do eixo *qualidade das
  respostas*: mede falhas (casos dourados + hit rate das regras) e promove
  candidatos de prompt só quando superam o baseline.
- O **L6** cobre o eixo *integridade do código*: testes e builds verdes.
- **Sinal de queda de desempenho → manutenção manual:** quando o aprendizado
  do L5 indica queda (eval score caindo, Insights recorrentes de falha,
  hit rate das regras em baixa), é o gatilho para rodar
  `bash scripts/self-maintenance.sh` fora do cron e inspecionar se o
  problema está no código (contratos, parsers, fixtures) e não no prompt.
  O relatório do L6 e o Insight do L5 leem as mesmas evidências por ângulos
  diferentes.

## Resumo das responsabilidades

| Etapa | Quem faz |
| --- | --- |
| Rodar testes/builds e propor correção mínima | Script + OpenCode CLI (L6) |
| Decidir se a correção é aceita | Humano (revisão do diff/PR) |
| Commitar, publicar branch e abrir PR | Humano |
| Mergear | Humano (nunca automático) |
| Promover candidato de prompt (L5) | Humano, contra o baseline |
