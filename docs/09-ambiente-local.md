# 09 — Ambiente local

## Pré-requisitos

- Node.js 20+ (recomendado 22 LTS; o ambiente atual tem 26).
- npm 10+.
- Docker + Docker Compose.
- Git.

## Subir infraestrutura

```bash
cd wsi-invest-ai
docker compose up -d
```

Serviços:
- PostgreSQL: `localhost:5433`
- Redis: `localhost:6379`

## Backend

```bash
cd back
cp .env.example .env
# edite DATABASE_URL, JWT secrets e OPENCODE_API_KEY
npm install
npx prisma generate
npx prisma migrate dev
npm run start:dev
```

- API: `http://localhost:3000/api`
- Swagger: `http://localhost:3000/api/docs`

## Frontend

```bash
cd front
npm install
npm start
```

- Web: `http://localhost:4200`

## Expor para usuários (local)

- **LAN:** acesse pelo IP da máquina; libere a porta no firewall.
- **Fora da rede:** use um túnel com TLS (ex.: Cloudflare Tunnel).
- Nunca exponha Postgres/Redis.
- Para múltiplos usuários, mantenha backup e atualização do host.

## Comandos úteis

```bash
# banco
npx prisma studio
npx prisma migrate dev --name <nome>
npx prisma migrate reset

# qualidade
npm run lint
npm test
npm run build
```

## Variáveis principais

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://wsi:wsi@localhost:5433/wsi_invest?schema=public
REDIS_HOST=localhost
REDIS_PORT=6379
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
# backup (mantém 7 dias)
./scripts/backup.sh

# restaurar
./scripts/restore.sh backups/wsi_invest_YYYYmmdd_HHMMSS.sql.gz
```

Variáveis: `PG_CONTAINER`, `PG_USER`, `PG_DB`, `BACKUP_DIR`.

## Solução de problemas

| Sintoma | Causa | Correção |
|---|---|---|
| `P1001` banco | Postgres não subiu | `docker compose ps` / logs |
| CORS | `FRONTEND_URL` errado | ajustar env |
| Login Google | callback divergente | conferir URL no Google Console |
| IA 401 | chave/modelo | testar conexão em Configurações |
| Migração falha | schema divergente | `prisma migrate reset` (dev) |
