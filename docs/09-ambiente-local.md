# 09 — Ambiente local

O app é local-first: usa **SQLite** (arquivo único) e não precisa de servidor de banco, Redis ou Docker.

## Pré-requisitos

- Node.js 20+ (recomendado 22 LTS; o ambiente atual tem 26).
- npm 10+.
- Git.

## Banco de dados

SQLite, sem servidor. O arquivo fica em `back/prisma/dev.db` (criado automaticamente via `prisma db push`).

- Não há `docker compose` — removido junto com Postgres/Redis.
- Ajuste o schema em `back/prisma/schema.prisma` e rode `npx prisma db push` (local dev).

## Backend

```bash
cd back
cp .env.example .env
# edite os JWT secrets e o OPENCODE_API_KEY
npm install
npx prisma db push     # cria o dev.db
npm run seed           # usuários admin/demo + dados de demonstração
npm run build
nohup node dist/main > /tmp/wsi-api.log 2>&1 &
```

- API: `http://localhost:3000/api`
- Swagger: `http://localhost:3000/api/docs`

## Frontend

```bash
cd front
npm install
npm start -- --host 0.0.0.0
```

- Web: `http://localhost:4200`

## Subir tudo de uma vez

```bash
./scripts/up.sh
```

## Expor para usuários (local)

- **LAN:** acesse pelo IP da máquina; libere a porta no firewall.
- **Fora da rede:** use um túnel com TLS (ex.: Cloudflare Tunnel).
- Para múltiplos usuários, mantenha backup do `dev.db` e atualização do host.

## Comandos úteis

```bash
# banco
npx prisma studio
npx prisma db push     # aplica o schema (local dev)

# qualidade
npm test
npm run build
```

## Variáveis principais

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=file:./dev.db
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback
FRONTEND_URL=http://localhost:4200
AI_DEFAULT_PROVIDER=opencode
OPENCODE_API_KEY=
OPENCODE_MODEL=deepseek-v4-pro
OPENCODE_BASE_URL=https://opencode.ai/zen/go/v1
AI_ENCRYPTION_KEY=
```

## Backup e restauração

```bash
# backup (copia dev.db, mantém 7 dias)
./scripts/backup.sh

# restaurar
./scripts/restore.sh backups/wsi_invest_YYYYmmdd_HHMMSS.db
```

## Solução de problemas

| Sintoma | Causa | Correção |
|---|---|---|
| `P1003` banco | `dev.db` não existe | rodar `npx prisma db push` |
| CORS | `FRONTEND_URL` errado | ajustar env |
| Login Google | callback divergente | conferir URL no Google Console |
| IA 401 | chave/modelo | testar conexão em Configurações |
| Schema divergente | model mudou | `npx prisma db push` (dev) |
