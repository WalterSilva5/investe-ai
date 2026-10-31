# wsi-invest-ai

Assistente pessoal de investimentos com **agente de IA**: organiza carteira, compara renda fixa, acompanha macro (Selic, IPCA, CDI), projeta patrimônio, emite alertas e explica decisões — **sem executar ordens**.

> **Aviso:** ferramenta educacional e analítica. Não é recomendação de investimento, não substitui contador/consultor e não executa operações.

## Funcionalidades

### Plataforma

- **Multi-tenant** com papéis (`OWNER/ADMIN/MEMBER/VIEWER`) e isolamento testado.
- **Auth:** e-mail/senha (Argon2), Google OAuth, JWT + refresh rotativo, **2FA (TOTP)**, troca e reset de senha.
- **Admin** (`ADMIN_EMAILS`): visão geral, usuários e uso de IA.
- **Hardening:** Helmet, rate limit global e no login/registro, CORS configurável, chaves criptografadas.

### Investimentos

- **Carteira:** ativos, contas, transações, posições, alocação e resumo.
- **Renda fixa:** simulação e comparação CDB/LCI/LCA/Tesouro com IR/isenção.
- **Macro:** Selic, IPCA e CDI via BCB (cache).
- **Cotações:** B3 (brapi) e cripto (CoinGecko), atualização manual e agendada.
- **Câmbio e ouro:** USD/BRL, EUR/BRL, GBP/BRL (AwesomeAPI) e ouro (gold-api) com conversão para BRL.
- **Análise:** runway, projeção de patrimônio e rebalanceamento.
- **Alertas** de alocação e macro.
- **Importação CSV** e **relatórios CSV/PDF**.

### Agente de IA

- **Multi-provedor** (OpenCode padrão, OpenAI, OpenRouter, Groq, DeepSeek, Mistral, Together, Gemini, LM Studio, Ollama).
- **Tools determinísticas** (carteira, macro, renda fixa, notas, memória, análise) com **citação de fonte e data**.
- **Streaming (SSE)** token a token, com fallback.
- **Perfis de agente** (geral, renda fixa, planejador, macro, cripto) — cada um com prompt e ferramentas próprios.
- **Memória do agente** (`remember`/`search_memory`) e **notas** (`search_documents`).
- **Insights periódicos**: dicas geradas por IA a partir de **notícias (RSS)** + **indicadores (Selic/IPCA/CDI)** + **carteira**, com painel dedicado, **filtro por categoria**, **badge de não lidos** e **digest por e-mail**.
- Quota mensal, histórico de conversas, passos visíveis e auditoria.

## Stack

- **Back:** NestJS 11 · Prisma 6 · PostgreSQL 16 · Redis 7 · BullMQ · Swagger.
- **Front:** Angular 20 · Tailwind · NgRx (parcial) · ngx-charts.
- **IA:** OpenAI SDK (adaptador compatible), SSE.
- **Infra:** Docker Compose, execução local.

## Início rápido

```bash
cd wsi-invest-ai
./scripts/up.sh        # sobe Docker, API (3000) e front (4200)
```

Ou manualmente:

```bash
docker compose up -d
cd back && cp .env.example .env   # edite DATABASE_URL, segredos e OPENCODE_API_KEY
cd back && npm install && npx prisma migrate dev && npm run build
cd back && nohup node dist/main > /tmp/wsi-api.log 2>&1 &
cd ../front && npm install && npm start -- --host 0.0.0.0
```

- **Web:** http://localhost:4200
- **API:** http://localhost:3000/api
- **Swagger:** http://localhost:3000/api/docs

## Estrutura

```
wsi-invest-ai/
├── back/          # API NestJS + Prisma
├── front/         # SPA Angular
├── docs/          # documentação
├── scripts/       # up.sh, backup.sh, restore.sh
└── docker-compose.yml
```

## Documentação

| Documento | Conteúdo |
|---|---|
| [Visão geral](docs/00-visao-geral.md) | problema, escopo, princípios, métricas |
| [Arquitetura](docs/01-arquitetura.md) | camadas, multi-tenant, IA, fluxo |
| [Plano de desenvolvimento](docs/02-plano-desenvolvimento.md) | fases, tarefas, critérios de aceite |
| [Módulos](docs/03-modulos.md) | catálogo back/front + status |
| [Modelo de dados](docs/04-modelo-dados.md) | entidades, relações, regras |
| [IA e provedores](docs/05-ia-provedores.md) | registry, roteamento, tools, guardrails |
| [Segurança e LGPD](docs/06-seguranca-lgpd.md) | ameaças, isolamento, privacidade |
| [ADRs](docs/07-adr.md) | decisões arquiteturais |
| [Roadmap](docs/08-roadmap.md) | MVP, beta, pós-MVP |
| [Ambiente local](docs/09-ambiente-local.md) | como rodar, backup |
| [API](docs/10-api.md) | referência de endpoints |
| [Agente de IA](docs/11-agente-de-ia.md) | arquitetura, tools, memória, streaming |

## Scripts

| Script | O que faz |
|---|---|
| `scripts/up.sh` | Sobe infra + API + front |
| `scripts/backup.sh` | Backup do Postgres (retém 7 dias) |
| `scripts/restore.sh` | Restaura a partir de um `.sql.gz` |

## Variáveis principais (`back/.env`)

```env
DATABASE_URL=postgresql://wsi:wsi@localhost:5433/wsi_invest?schema=public
JWT_ACCESS_SECRET=...        JWT_REFRESH_SECRET=...
GOOGLE_CLIENT_ID=...         GOOGLE_CLIENT_SECRET=...
OPENCODE_API_KEY=...         OPENCODE_MODEL=deepseek-v4-pro
AI_ENCRYPTION_KEY=...        AI_MONTHLY_TOKEN_QUOTA=200000
ADMIN_EMAILS=...             CORS_ORIGINS=...
BRAPI_TOKEN=                 ENABLE_CRON=true
```

## Testes

```bash
cd back && npm test   # 10 testes: renda fixa, isolamento multi-tenant, projeção
```

## Próximo

- Perfis de agente (prompts/tools por papel).
- RAG com embeddings (hoje é busca textual).
- Moedas múltiplas e cotações internacionais.
- Exposição a usuários externos (túnel/TLS, backup agendado, termos/privacidade).
