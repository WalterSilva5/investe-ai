# wsi-invest-ai

Assistente pessoal de investimentos com agente de IA: organiza carteira, compara renda fixa, acompanha macro (Selic, IPCA, CDI), simula cenários e explica decisões — **sem executar ordens**.

> **Aviso:** ferramenta educacional e analítica. Não é recomendação de investimento, não substitui contador/consultor e não executa operações.

## Stack

- **Back:** NestJS 11 · Prisma 6 · PostgreSQL 16 · Redis 7 + BullMQ · JWT + Google OAuth · Swagger.
- **Front:** Angular 20 · Tailwind + DaisyUI · NgRx · ngx-charts.
- **IA:** LangChain.js + LangGraph.js, multi-provedor (OpenCode primeiro).
- **Infra:** Docker Compose, execução local.

## Estrutura

```
wsi-invest-ai/
├── back/          # API NestJS + Prisma
├── front/         # SPA Angular
├── docs/          # visão, arquitetura, planos, módulos, segurança
├── infra/         # compose, scripts auxiliares
└── docker-compose.yml
```

## Documentação

| Documento | Conteúdo |
|---|---|
| [Visão geral](docs/00-visao-geral.md) | problema, escopo, princípios, métricas |
| [Arquitetura](docs/01-arquitetura.md) | camadas, multi-tenant, IA, fluxo de dados |
| [Plano de desenvolvimento](docs/02-plano-desenvolvimento.md) | fases, tarefas, critérios de aceite |
| [Módulos](docs/03-modulos.md) | catálogo de módulos back/front |
| [Modelo de dados](docs/04-modelo-dados.md) | entidades, relações, regras |
| [IA e provedores](docs/05-ia-provedores.md) | registry, roteamento, tools, guardrails |
| [Segurança e LGPD](docs/06-seguranca-lgpd.md) | ameaças, isolamento, privacidade |
| [ADRs](docs/07-adr.md) | decisões arquiteturais |
| [Roadmap](docs/08-roadmap.md) | MVP, beta, pós-MVP |
| [Ambiente local](docs/09-ambiente-local.md) | como rodar |

## Início rápido

```bash
# 1. infraestrutura
docker compose up -d

# 2. backend
cd back
cp .env.example .env
npm install
npx prisma migrate dev
npm run start:dev

# 3. frontend
cd ../front
npm install
npm start
```

- API: `http://localhost:3000/api`
- Swagger: `http://localhost:3000/api/docs`
- Web: `http://localhost:4200`

## Status

Fundação + carteira + renda fixa + macro + alertas + importação/relatório + cotações + agente com tools.

- Auth multi-tenant (e-mail/senha, Google OAuth opcional, refresh rotativo).
- Carteira manual: ativos, transações, posições, alocação, resumo.
- Renda fixa: simulação e comparação com IR/isenção.
- Macro: Selic, IPCA e CDI via BCB.
- Alertas de alocação máxima e macro.
- Importação CSV de transações e relatório CSV da carteira.
- Cotações B3/cripto com atualização manual e agendada (dias úteis, 18h).
- IA: registry multi-provedor, OpenCode padrão, chaves criptografadas, chat com **tools determinísticas** (carteira, macro, renda fixa), citações, **quota mensal**, uso e auditoria.
- **Testes de isolamento multi-tenant** cobrindo carteira, resumo e transações.
- Frontend: login, visão geral, carteira, renda fixa, alertas, chat e configuração de provedores.

Próximo: relatório PDF, RAG, admin/uso e hardening para usuários externos.
