# 10 — Referência da API

Base: `http://localhost:3000/api` (prefixo configurável via `API_PREFIX`).
Autenticação: `Authorization: Bearer <accessToken>`. Rotas protegidas exigem também o header `x-tenant-id` (resolvido automaticamente se omitido).
Documentação interativa: `GET /api/docs` (Swagger).

## Autenticação (`/auth`)

| Método | Rota | Descrição | Auth |
|---|---|---|---|
| POST | `/auth/register` | Cria usuário + tenant pessoal | — |
| POST | `/auth/login` | Login (aceita `twoFactorCode` se 2FA ativo) | — |
| POST | `/auth/refresh` | Rotaciona refresh token | — |
| POST | `/auth/logout` | Revoga refresh token | — |
| GET | `/auth/me` | Perfil + membros + `twoFactorEnabled` | JWT |
| POST | `/auth/change-password` | Troca senha (revoga sessões) | JWT |
| POST | `/auth/2fa/setup` | Gera segredo TOTP + URL `otpauth://` | JWT |
| POST | `/auth/2fa/confirm` | Ativa 2FA com código | JWT |
| POST | `/auth/2fa/disable` | Desativa 2FA com código | JWT |
| POST | `/auth/forgot-password` | Cria token de reset (link logado em dev) | — |
| POST | `/auth/reset-password` | Redefine senha com token | — |
| GET | `/auth/google` · `/auth/google/callback` | OAuth Google | — |

## Health (`/health`)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/health` | Status do serviço |

## Tenants (`/tenants`)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/tenants` | Workspaces do usuário (com papel, `kind` PF/PJ e CNPJ) |
| POST | `/tenants` | Cria workspace (empresa) — `{ name, cnpj?, kind? }` — e vincula como OWNER |

## Extratos bancários (`/banking`)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/banking/statements` | Lista extratos importados |
| GET | `/banking/summary?months=6` | Entradas, saídas, saldo, por mês e por categoria |
| GET | `/banking/categories` | Categorias disponíveis |
| POST | `/banking/statements` | Importa colando conteúdo — `{ name, institution?, format: OFX\|CSV, content }` |
| POST | `/banking/statements/upload` | Importa arquivo (multipart) — OFX/CSV/PDF |
| POST | `/banking/recategorize` | Reaplica a categorização automática nas transações sem categoria |
| POST | `/banking/reconcile` | Concilia extrato ↔ carteira (valor + data ±3 dias) |
| GET | `/banking/reconciliation` | Lista conciliadas e pendentes |
| POST | `/banking/reconciliation/:id/unlink` | Desfaz a conciliação de uma transação |
| GET | `/banking/statements/:id` | Transações de um extrato |
| DELETE | `/banking/statements/:id` | Remove extrato e transações |
| PATCH | `/banking/transactions/:id` | Altera a categoria — `{ category }` |

## Carteira (`/assets`, `/portfolios`, `/transactions`)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/assets` | Lista ativos (filtro `type`, `search`) |
| POST | `/assets` | Cria/atualiza ativo (`symbol+type`) |
| GET | `/assets/:id` | Detalhe do ativo |
| GET | `/portfolios` | Carteiras do tenant |
| POST | `/portfolios` | Cria carteira |
| GET | `/portfolios/:id` | Detalhe (com contas) |
| PATCH | `/portfolios/:id` | Edita nome/padrão |
| DELETE | `/portfolios/:id` | Remove |
| POST | `/portfolios/:id/accounts` | Cria conta |
| GET | `/portfolios/:id/positions` | Posições (com preço de mercado) |
| GET | `/portfolios/:id/allocation` | Alocação por tipo e ativo |
| GET | `/portfolios/:id/summary` | Resumo (patrimônio, P&L) |
| GET | `/portfolios/:id/transactions` | Transações |
| POST | `/portfolios/:id/transactions` | Cria transação (recalcula posição) |
| DELETE | `/transactions/:id` | Remove transação |

## Renda fixa (`/fixed-income`)

| Método | Rota | Descrição |
|---|---|---|
| POST | `/fixed-income/simulate` | Simula CDB/LCI/LCA/Tesouro (IR/isenção) |
| POST | `/fixed-income/compare` | Compara uma lista de produtos |

## Mercado (`/market`)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/market/macro` | Selic, IPCA e CDI (BCB) |
| GET | `/market/international` | Câmbio (USD/EUR/GBP) + ouro, com ouro em BRL |
| GET | `/market/quote/:symbol` | Cotação (brapi/CoinGecko) |
| POST | `/market/refresh` | Atualiza cotações da carteira padrão |

## Alertas (`/alerts`)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/alerts` | Regras + eventos recentes |
| POST | `/alerts` | Cria regra (`ALLOCATION_MAX` ou `MACRO`) |
| PATCH | `/alerts/:id` | Edita condição/enabled |
| DELETE | `/alerts/:id` | Remove |
| POST | `/alerts/evaluate` | Avalia regras e dispara eventos |

## Importação e relatórios (`/import`, `/reports`)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/import/template` | CSV modelo |
| POST | `/import/transactions` | Importa transações de CSV |
| GET | `/reports/portfolio/:id/csv` | Relatório CSV |
| GET | `/reports/portfolio/:id/pdf` | Relatório PDF |

## Notas e memórias (`/documents`, `/memories`)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/documents` | Lista notas |
| POST | `/documents` | Cria nota |
| GET | `/documents/search?q=` | Busca textual |
| GET | `/documents/:id` | Detalhe |
| DELETE | `/documents/:id` | Remove |
| GET | `/memories` | Lista memórias do agente |
| POST | `/memories` | Cria memória (kind/importance) |
| GET | `/memories/search?q=` | Busca |
| DELETE | `/memories/:id` | Remove |

## Análise (`/analysis`)

| Método | Rota | Descrição |
|---|---|---|
| POST | `/analysis/runway` | Meses que o patrimônio sustenta a despesa |
| POST | `/analysis/project` | Projeção de valor futuro |
| POST | `/analysis/rebalance` | Desvio da alocação vs. meta |

## IA (`/ai`, `/ai/providers`)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/ai/providers` | Catálogo + status de configuração |
| POST | `/ai/providers/:id/credential` | Salva chave (criptografada) |
| POST | `/ai/providers/:id/test` | Testa conexão |
| GET | `/ai/providers/:id/models` | Lista modelos |
| POST | `/ai/chat` | Conversa (tools + citações + passos) |
| POST | `/ai/chat/stream` | Conversa com streaming (SSE) |
| GET | `/ai/profiles` | Perfis de agente disponíveis |
| GET | `/ai/usage` | Quota/uso de IA do mês |
| POST | `/ai/tools/:name` | Executa tool determinística (teste) |
| GET | `/ai/conversations` | Histórico de conversas |
| GET | `/ai/conversations/:id` | Mensagens de uma conversa |

## Oportunidades de negócio (`/business`)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/business/profile` | Perfil profissional |
| PUT | `/business/profile` | Salva/atualiza o perfil |
| GET | `/business/catalog` | Tipos de negócio |
| GET | `/business/ideas` | Ideias geradas |
| POST | `/business/ideas` | Gera ideias (`{ focus?, kinds? }`) |

## Radar de oportunidades (`/opportunities`)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/opportunities/themes` | Catálogo de temas/narrativas |
| GET | `/opportunities/cycles` | Ciclos históricos e lições |
| GET | `/opportunities/radar` | Atenção + tendência + último brief por tema |
| GET | `/opportunities?theme=` | Briefs gerados |
| POST | `/opportunities/:theme/analyze` | Gera análise (`{ mode: growth\|conservative }`) |

## Insights de IA (`/insights`)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/insights` | Lista os insights (filtro opcional `?category=`) |
| GET | `/insights/unread-count` | Conta insights não lidos |
| POST | `/insights/refresh` | Gera novos insights (notícias + macro + carteira) |
| POST | `/insights/read-all` | Marca todos como lidos |
| PATCH | `/insights/:id/read` | Marca um insight como lido |

Categorias: `MACRO`, `RENDA_FIXA`, `ACOES`, `CRIPTO`, `CARTEIRA`, `GERAL`.

## Admin (`/admin`)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/admin/overview` | Contagens + uso de IA + auditoria |
| GET | `/admin/users` | Usuários com tokens/mês |
| GET | `/admin/usage` | Uso de IA por tenant |

> Requer e-mail em `ADMIN_EMAILS` (separado por vírgula).
