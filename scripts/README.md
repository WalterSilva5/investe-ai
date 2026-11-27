# Scripts

- `up.sh` — sobe a API (porta 3000, em background) e o frontend (porta 4200) no ambiente local.
- `backup.sh` — copia o banco SQLite (`back/prisma/dev.db`) para `backups/` com retenção de 7 dias.
- `restore.sh` — restaura o banco a partir de um arquivo de backup em `backups/`.
- `self-maintenance.sh` — degrau L6: cria worktree isolado, roda testes/builds (back+front), corrige via OpenCode CLI em caso de falha e gera relatório para PR manual (sem push/merge automático; ver `docs/15-self-maintenance.md`).
