# 02 — Plano de desenvolvimento

## Estratégia

Entrega incremental, com o **número sempre vindo de código**. Cada fase termina com algo usável e testado. Nada de "IA primeiro": a base de dados, auth e carteira vêm antes do agente.

## Fases

### Fase 0 — Fundação (semana 1)

**Objetivo:** projeto roda, autentica, isola tenants e conversa com um provedor de IA.

- [ ] Monorepo, `.gitignore`, `.env.example`, `docker-compose.yml`.
- [ ] Backend NestJS 11 + Prisma 6 + Swagger + Pino.
- [ ] `schema.prisma` inicial (tenant, user, membership, provider).
- [ ] Auth e-mail/senha + JWT + refresh.
- [ ] Google OAuth (opcional por env).
- [ ] `TenantGuard` + extensão Prisma de escopo.
- [ ] Healthcheck.
- [ ] Registry de IA com adaptador OpenAI-compatible + OpenCode.
- [ ] Chat simples (sem tools) com streaming.
- [ ] Front Angular com login e shell.

**Aceite:** criar usuário, logar, criar tenant pessoal, trocar mensagem com OpenCode, nenhum dado cruza tenant.

### Fase 1 — Carteira (semanas 2–3)

- [ ] CRUD de portfólio, contas, ativos e transações.
- [ ] Posições derivadas e alocação.
- [ ] Dashboard (patrimônio, alocação, evolução).
- [ ] IPS (perfil, metas, bandas).
- [ ] Importação CSV básica.

**Aceite:** cadastrar carteira real, ver alocação e evolução; importar CSV sem duplicar.

### Fase 2 — Renda fixa e macro (semana 4)

- [ ] Integração BCB SGS (Selic, IPCA, CDI) com cache.
- [ ] Tesouro Transparente (taxas).
- [ ] Calculadora CDB/LCI/LCA/Tesouro com IR/IOF/FGC.
- [ ] Comparador de produtos.
- [ ] Runway e renda projetada.

**Aceite:** comparar dois produtos e ver rendimento líquido; calcular runway a partir da reserva/despesa.

### Fase 3 — Agente (semanas 5–6)

- [ ] Tools de carteira, macro, renda fixa, análise e auditoria.
- [ ] LangGraph com estado e citações.
- [ ] Guardrails (sem execução, sem previsão, com fonte).
- [ ] Auditoria de tool calls e custo.
- [ ] Quotas de IA.

**Aceite:** perguntas como "qual minha alocação?", "e se a Selic cair para 10%?", "compare CDB 14% com Tesouro IPCA+" respondidas com números corretos e fonte.

### Fase 4 — Mercado e alertas (semanas 7–8)

- [ ] Cotações B3 (brapi) e exterior, com cache e proveniência.
- [ ] Alertas de desvio de banda, preço e macro.
- [ ] Relatórios PDF/CSV.
- [ ] Importação CSV/OFX mais robusta.

**Aceite:** alerta dispara; relatório mensal gerado.

### Fase 5 — Hardening e abertura (semanas 9–10)

- [ ] Testes de isolamento multi-tenant.
- [ ] Rate limit, captcha, verificação de e-mail.
- [ ] Backup/restore documentado.
- [ ] Termos, privacidade, disclaimer.
- [ ] Observabilidade (logs, health, métricas).
- [ ] Admin básico (usuários, uso de IA).

**Aceite:** checklist de segurança e LGPD; usuário convidado consegue usar sem acesso a dados de outro.

## Definição de pronto (DoD)

- Código tipado, lint e build passando.
- Teste unitário da regra de negócio.
- Teste de integração quando envolve banco.
- Swagger atualizado.
- Sem segredo no código/log.
- Escopo de tenant aplicado.
- Documentação do módulo atualizada.

## Testes

| Tipo | O que cobre |
|---|---|
| Unitário | calculadoras, serviços, guards, tools |
| Integração | Prisma, auth, isolamento de tenant |
| E2E | login, carteira, chat |
| Contrato | adaptadores de provedor (mock) |
| Avaliação de IA | perguntas douradas, consistência numérica, recusas |

## Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Alucinação numérica | tools determinísticas + validação + citação |
| Vazamento entre tenants | extensão Prisma + testes dedicados |
| Custo de IA | quota, roteamento, cache, modelo barato |
| Dados sem licença | começar manual/BCB/Tesouro; revisar termos |
| Base antiga | caminho limpo (NestJS 11/Prisma 6) |
| Escopo | MVP pessoal/local; público depois |

## Cronograma

10 semanas para o MVP local com usuários convidados. Cada fase é um marco independente; atraso em uma não bloqueia a anterior.
