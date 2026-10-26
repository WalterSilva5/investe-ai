# 01 — Arquitetura

## Visão de alto nível

```
┌────────────────────┐        HTTP/SSE        ┌──────────────────────────┐
│  Front (Angular)   │ ─────────────────────▶ │  API (NestJS)            │
│  dashboard, chat   │ ◀───────────────────── │  auth, carteira, IA      │
└────────────────────┘                        └───────────┬──────────────┘
                                                         │
                         ┌───────────────────────────────┼───────────────────────────────┐
                         │                               │                               │
                  ┌──────▼──────┐                 ┌──────▼──────┐                 ┌──────▼──────┐
                  │ PostgreSQL  │                 │   Redis     │                 │  Provedores │
                  │ dados/tenant│                 │ cache/filas │                 │  de IA      │
                  └─────────────┘                 └─────────────┘                 └─────────────┘
```

## Monorepo

```
back/   API NestJS (domínio + IA)
front/  SPA Angular
docs/   documentação
infra/  compose, scripts
```

Sem workspace compartilhado no início: `back` e `front` são independentes. Tipos compartilhados são gerados a partir do Swagger/OpenAPI quando necessário.

## Backend (NestJS)

### Camadas

- **Controller:** HTTP/DTO/Swagger, sem regra de negócio.
- **Service:** regra de negócio e orquestração.
- **Repository/Prisma:** acesso a dados.
- **Module:** fronteira de domínio.

### Módulos de domínio

`auth`, `users`, `tenants`, `portfolios`, `assets`, `transactions`, `market-data`, `fixed-income`, `analysis`, `ai`, `ai-provider`, `reports`, `alerts`, `import`, `audit`, `health`.

Detalhe em [03-modulos](03-modulos.md).

### Multi-tenant

- Banco único, coluna `tenantId` em todas as tabelas de domínio.
- `TenantGuard` resolve o tenant do usuário autenticado.
- Extensão do Prisma injeta `tenantId` em leituras/escritas e bloqueia cross-tenant.
- Testes obrigatórios de isolamento.

### Auth

- E-mail/senha com Argon2 + JWT curto + refresh token rotativo.
- Google OAuth.
- Verificação de e-mail, reset de senha.
- 2FA (TOTP) pós-MVP.

## IA

### Registry de provedores

`ai-provider` implementa `IAIProvider` e um registry com adaptadores:

- **OpenAI-compatible** (base): OpenCode, OpenAI, OpenRouter, Groq, DeepSeek, Mistral, Together, Gemini, LM Studio, Ollama.
- **Nativos:** Anthropic, Vertex AI (opcionais).

Configuração por usuário (chave criptografada) e por agente (modelo/temperatura/tokens). Fallback e roteamento por tarefa.

### Agente

- LangGraph.js: intenção → tools → análise → resposta.
- Tools determinísticas (carteira, macro, renda fixa, cenários, RAG).
- Resposta com fonte/data e disclaimer.
- Sem execução de ordens.

Detalhe em [05-ia-provedores](05-ia-provedores.md).

## Fluxo de uma análise

1. Front envia pergunta + contexto do portfólio.
2. API identifica o tenant/usuário.
3. Agente escolhe tools (ex.: `getAllocation`, `getMacro`, `simulateFixedIncome`).
4. Tools consultam banco/cache/fonte externa e retornam JSON.
5. LLM redige a análise **usando apenas** os números retornados.
6. Resposta inclui fontes, datas e disclaimer.
7. `AuditEvent` registra pergunta, tools, modelo, tokens e custo.

## Dados

- **PostgreSQL:** domínio, histórico, auditoria.
- **Redis:** cache de cotações/macro, rate limit, filas BullMQ.
- **Proveniência:** toda série/valor guarda `source` e `fetchedAt`.

## Deploy local

- `docker compose` sobe Postgres e Redis.
- API e web rodam no host (dev) ou em containers (produção local).
- Exposição para usuários: LAN ou túnel (Cloudflare Tunnel). Para uso local, sem TLS público; para usuários externos, usar túnel com TLS.
- Backup do Postgres é responsabilidade do operador.

## Requisitos não funcionais

- **Segurança:** OWASP, rate limit, validação, criptografia de chaves, auditoria.
- **Observabilidade:** logs estruturados (Pino), healthcheck, métricas básicas.
- **Performance:** cache de mercado; respostas de IA em streaming.
- **Resiliência:** fallback de provedor; retries com limite; timeout.
- **LGPD:** consentimento, exportação, exclusão, retenção.

## Decisões e trade-offs

Ver [07-adr](07-adr.md). Resumo:

- NestJS 11 + Prisma 6 (caminho limpo).
- Angular 20 (reuso das bases).
- Multi-tenant shared schema (simples e suficiente).
- IA em TypeScript (um runtime).
- Local-first (simplicidade).
- Sem execução de ordens (risco e escopo).
