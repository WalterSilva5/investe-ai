# 03 — Catálogo de módulos

## Backend

| Módulo | Responsabilidade | Endpoints principais | Depende de | Status |
|---|---|---|---|---|
| `health` | Healthcheck e readiness | `GET /health` | — | a criar |
| `auth` | Login, refresh, Google OAuth, verificação, reset | `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/google` | users, tenants | a criar |
| `users` | Perfil, preferências, consentimento | `GET/PATCH /users/me` | auth | a criar |
| `tenants` | Tenant pessoal, membros, papéis | `GET /tenants`, `/tenants/:id/members` | auth | a criar |
| `portfolios` | Carteiras e contas | `GET/POST /portfolios`, `/accounts` | assets | a criar |
| `assets` | Catálogo de ativos (ação, FII, ETF, RF, cripto) | `GET/POST /assets` | — | a criar |
| `transactions` | Compra/venda/aporte/provento | `GET/POST /transactions` | portfolios, assets | a criar |
| `positions` | Posição derivada e alocação | `GET /portfolios/:id/positions`, `/allocation` | transactions, market-data | a criar |
| `market-data` | Cotações, câmbio, séries macro | `GET /market/quotes`, `/market/macro` | cache, fontes | a criar |
| `fixed-income` | Tesouro/CDB/LCI/LCA, IR/IOF/FGC | `POST /fixed-income/simulate`, `/compare` | market-data | a criar |
| `analysis` | Runway, projeção, rebalanceamento, cenários | `POST /analysis/runway`, `/rebalance`, `/scenario` | portfolios, fixed-income | a criar |
| `ai-provider` | Registry de provedores, config, teste, modelos | `GET /ai/providers`, `POST /ai/providers/:id/test` | settings | a criar |
| `ai` | Chat, agente, tools, streaming, uso | `POST /ai/chat`, `GET /ai/conversations` | ai-provider, analysis | a criar |
| `reports` | PDF/CSV | `POST /reports/monthly` | portfolios | a criar |
| `alerts` | Regras e eventos | `GET/POST /alerts` | market-data | a criar |
| `import` | CSV/OFX | `POST /import/csv` | transactions | a criar |
| `audit` | Trilha de auditoria | `GET /audit` | — | a criar |
| `admin` | Usuários, tenants, uso (local) | `GET /admin/users`, `/admin/usage` | auth | a criar |

### Convenções

- Todo controller em `/api`.
- Todo DTO validado (`class-validator`/Zod) e documentado no Swagger.
- Todo serviço recebe `tenantId` do contexto, nunca do body.
- Dinheiro em `Decimal`; datas em UTC; respostas com `source`/`fetchedAt` quando dado externo.

## Frontend (Angular)

| Módulo | Telas | Depende de |
|---|---|---|
| `auth` | login, cadastro, esqueci senha, callback Google | API auth |
| `shell` | layout, navegação, tenant ativo | auth |
| `onboarding` | perfil de risco, IPS, metas, disclaimers | API users/analysis |
| `dashboard` | patrimônio, alocação, evolução, runway | API positions/analysis |
| `portfolio` | carteira, contas, transações, importação | API portfolios/transactions |
| `fixed-income` | simulador e comparador | API fixed-income |
| `analysis` | cenários, rebalanceamento, projeções | API analysis |
| `chat` | conversa com agente, streaming, fontes | API ai |
| `alerts` | regras e eventos | API alerts |
| `settings` | provedores/API keys, agente, quota | API ai-provider |
| `audit` | histórico de análises | API audit |
| `admin` | usuários/uso (local) | API admin |

### Convenções

- Estado com NgRx por feature; chamadas via serviço HTTP tipado.
- Gráficos com ngx-charts/chart.js.
- Tema Tailwind + DaisyUI.
- Guard de rota para auth e tenant.
- Disclaimer visível nas telas de análise.

## Fronteiras

- `ai` não acessa banco diretamente: usa tools/services.
- `market-data` é a única porta para fontes externas.
- `fixed-income` e `analysis` são funções puras sobre dados, fáceis de testar.
- `audit` é transversal e somente escrita pela API.

## Ordem de implementação

1. `health` → `auth` → `users`/`tenants` → `ai-provider` → `ai` (chat sem tools).
2. `assets` → `portfolios` → `transactions` → `positions` → dashboard.
3. `market-data` → `fixed-income` → `analysis`.
4. Tools do agente → auditoria → quotas.
5. `alerts` → `reports` → `import` → `admin`.

## Status da implementação

| Módulo | Status |
|---|---|
| `health` | ✅ implementado |
| `auth` | ✅ implementado (e-mail/senha + Google OAuth opcional + refresh rotativo) |
| `users` | ✅ via `GET /auth/me` (módulo dedicado depois) |
| `tenants` | ✅ listagem e isolamento |
| `assets` | ✅ CRUD básico |
| `portfolios` | ✅ CRUD, contas, posições, alocação e resumo |
| `transactions` | ✅ criação/exclusão + recálculo de posição |
| `market-data` | ✅ macro BCB + cotações (brapi/CoinGecko) |
| `scheduler` | ✅ cron de cotações + alertas (dias úteis 18h) |
| `fixed-income` | ✅ simulação e comparação (IR/isenção) |
| `ai-provider` | ✅ registry, credenciais criptografadas, teste/modelos |
| `ai` | ✅ chat com tools (carteira/macro/renda fixa/notas/memória/runway/projeção/rebalance), streaming (SSE), citações, passos, quota mensal, histórico, uso e auditoria |
| `insights` | ✅ dicas de IA (notícias RSS + macro + carteira), painel com filtro por categoria, badge de não lidos, digest por e-mail e cron diário |
| `audit` | 🟡 gravação de eventos de IA; tela depois |
| `analysis` | ✅ runway, projeção e rebalanceamento |
| `alerts` | ✅ CRUD + avaliação (alocação máxima e macro) |
| `reports` | ✅ Relatório da carteira em CSV e PDF |
| `import` | ✅ CSV de transações (validação + recálculo de posição) |
| `documents` | ✅ Notas + busca textual + tool `search_documents` |
| `memories` | ✅ Memória do agente + tools `remember`/`search_memory` |
| `admin` | ✅ Visão geral, usuários e uso de IA (ADMIN_EMAILS) |
| `backup` | ✅ `scripts/backup.sh` e `scripts/restore.sh` |
| `security` | ✅ Helmet, rate limit, CORS, 2FA (TOTP), troca e reset de senha |

