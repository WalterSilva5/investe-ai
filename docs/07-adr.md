# 07 — Decisões arquiteturais (ADRs)

## ADR-001 — NestJS 11 + Prisma 6

**Decisão:** caminho limpo, sem herdar NestJS 8/Prisma 4.8 do treina.
**Motivo:** versões antigas, EOL e dívida técnica. Base nova, padrões copiados.
**Consequência:** mais trabalho inicial; menos dor depois.

## ADR-002 — PostgreSQL + Redis

**Decisão:** PostgreSQL 16 para domínio; Redis 7 para cache/filas.
**Motivo:** consistência, transações, pgvector futuro, BullMQ.
**Consequência:** dois serviços no compose.

## ADR-003 — Angular 20

**Decisão:** Angular, não React.
**Motivo:** as duas bases já são Angular; reuso de shell, auth, charts e Capacitor.
**Consequência:** menos retrabalho de UI.

## ADR-004 — Multi-tenant shared schema

**Decisão:** banco único com `tenantId` + extensão Prisma.
**Motivo:** simples, suficiente para uso pessoal e convidados.
**Consequência:** isolamento depende de disciplina e testes.

## ADR-005 — IA em TypeScript

**Decisão:** portar o padrão do maestro para TS (LangChain.js/LangGraph.js), sem sidecar Python.
**Motivo:** um runtime, deploy simples, tipos compartilhados.
**Consequência:** reescrever tools/orquestração; catálogo de provedores é reaproveitado como referência.

## ADR-006 — Local-first

**Decisão:** rodar localmente; abertura para usuários via LAN/túnel.
**Motivo:** simplicidade, custo baixo, privacidade.
**Consequência:** backup, TLS e disponibilidade são responsabilidade do operador.

## ADR-007 — OpenCode primeiro

**Decisão:** OpenCode é o provedor padrão inicial; demais entram pelo mesmo adaptador.
**Motivo:** chave disponível e endpoint OpenAI-compatible.
**Consequência:** dependência de um provedor no início; fallback preparado.

## ADR-008 — Sem execução de ordens

**Decisão:** o agente apenas analisa, informa e sugere; nunca executa.
**Motivo:** risco financeiro, regulatório e de segurança.
**Consequência:** integrações de trading ficam fora do escopo.

## ADR-009 — Dados manuais + fontes públicas

**Decisão:** carteira manual/CSV; macro via BCB/Tesouro; cotações gratuitas depois.
**Motivo:** evita dependência de licença e integração de corretora no início.
**Consequência:** atualização manual no MVP.

## ADR-010 — Sem recomendação personalizada

**Decisão:** posicionamento educacional/analítico, com disclaimer.
**Motivo:** reduz risco regulatório (CVM) e responsabilidade.
**Consequência:** o agente explica e compara, não diz "compre/venda".
