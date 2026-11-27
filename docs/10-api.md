# 10 — Referência da API

Base: `http://localhost:3000/api` (prefixo configurável via `API_PREFIX`).
Autenticação: `Authorization: Bearer <accessToken>`. Rotas protegidas exigem também o header `x-tenant-id` (resolvido automaticamente se omitido).
Modo do ambiente: `AUTH_ENABLED=false` (padrão) = aberto, sem login (assume app local); `AUTH_ENABLED=true` = exige conta. `GET /health` expõe `authEnabled`.
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
| GET | `/portfolios/:id/income` | Proventos por ativo (total, 12m, DY recebido) |
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
| GET | `/market/history?symbol=&range=` | Histórico p/ gráfico (1mo, 3mo, 6mo, 1y, 5y; brapi/CoinGecko) |
| GET | `/market/levels?symbol=&range=` | Cotação + suportes/resistências + MM20/MM50 (brapi/CoinGecko/Yahoo) |
| GET | `/market/indicators?symbol=&range=` | Dashboard: preço, RSI(14), médias, volatilidade, variações 1d/1s/1m/3m/1a |
| GET | `/market/patterns?symbol=&setup=&range=` | Backtest de um padrão num ticker específico (+5/+10/+20 barras) |
| GET | `/market/seer?range=&limit=&symbols=` | Vidente geral: varre o universo, pega o padrão atual de cada papel e ranqueia pelo histórico |
| GET | `/market/halving` | Contexto do ciclo do BTC: dias até o próximo halving (estimado), fase e referência histórica |

## Ensino (`/teach`)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/teach` | Currículo (6 aulas) com progresso do usuário |
| GET | `/teach/:id` | Aula completa com dados de mercado AO VIVO (exemplo + exercício) |
| POST | `/teach/:id/answer` | Corrige o exercício contra os dados atuais (`{ value }`) |
| POST | `/teach/:id/complete` | Marca a aula como concluída |

## Notificações (`/notifications`)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/notifications?take=` | Lista as notificações (mais recentes primeiro) |
| GET | `/notifications/unread-count` | Contador de não lidas |
| POST | `/notifications/:id/read` | Marca uma como lida |
| POST | `/notifications/read-all` | Marca todas como lidas |

Gatilhos automáticos: dicas de ação com veredito `Oportunidade` (🔥) e radar contrário com `Reversão forte` nota ≥70; cron dias úteis 12h roda a varredura de quedas para criar notificações sem ação manual.
| GET | `/market/outlook?symbol=&range=` | Resumo: veredito (Oportunidade/Aguardar/Evitar), gatilho, invalidação, tendência, score, ganho/risco e histórico do padrão |
| POST | `/market/refresh` | Atualiza cotações da carteira padrão |

## Aprendizado (`/learning`)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/learning/outlook?symbol=&range=` | Outlook com score calibrado pela taxa de acerto histórica da regra + registro do sinal do dia |
| GET | `/learning/summary` | Desempenho por regra (acerto, retorno médio, status de calibração) |
| POST | `/learning/evaluate` | Avalia sinais pendentes com 14+ dias (também roda no cron dias úteis 19h) |

## Descobertas (`/discovery`)
| Método | Rota | Descrição |
|---|---|---|
| GET | `/discovery/tracked` | Watchlist do usuário (descobertos + manuais) |
| POST | `/discovery/scan?limit=` | Varre o universo, pontua e grava os melhores (também roda no cron 2ª 8h) |
| POST | `/discovery/tracked/:symbol` | Adiciona ticker manualmente |
| DELETE | `/discovery/tracked/:symbol` | Remove da watchlist |

## Paper trading (`/paper`)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/paper/portfolio` | Propostas + posições simuladas, retorno % e comparação pro-rata com o CDI |
| POST | `/paper/generate` | Gera propostas a partir do último digest de dicas de ação (veredito "Oportunidade") e executa no paper na cotação atual — sem duplicar símbolo no mesmo dia |
| POST | `/paper/proposals/:id/reject` | Recusa a proposta (sai da fila, não entra no paper) |

Simulação de ordens: sem dinheiro real e sem execução em corretora. O ciclo roda no cron dias úteis 18h30 (gate `PAPER_AUTO`).

## Prompts do agente (`/prompts`)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/prompts/profiles` | Perfis disponíveis (geral, renda fixa, planejador, macro, cripto) |
| GET | `/prompts?profile=` | Versões do perfil (ativa, candidatos, arquivadas) com nota da avaliação |
| GET | `/prompts/:id` | Detalhe da versão + últimas avaliações |
| POST | `/prompts` | Cria versão **candidata** (`{ profileId, systemPrompt, notes }`) — não ativa |
| POST | `/prompts/:id/evaluate` | Roda o conjunto dourado e salva a nota (`{ score, baseline, verdict, results }`) |
| POST | `/prompts/:id/activate` | Ativa a versão (arquiva a anterior) |
| POST | `/prompts/tune?profile=` | Auto-ajuste: redige candidato com base nas falhas medidas, avalia e promove só com margem (+ cron diário 7h) |
| POST | `/prompts/swarm?profiles=` | Swarm: auto-ajuste para todos os perfis em paralelo (+ cron toda segunda 7h) |
| POST | `/ai/chat` (com `image`) | Mensagem + imagem anexada (data URL): visão direta se o modelo enxerga, duas etapas (`AI_VISION_MODEL`) ou OCR local (tesseract) |
| GET | `/prompts/sim/results` | Runs recentes do backtest de prompts por classe de ativo |
| GET | `/prompts/sim/best` | Melhor variante de prompt por classe (pela nota do backtest) |
| POST | `/prompts/sim/run` | Roda a matriz de simulação: âncoras no passado × variantes × classes (leva minutos) |
| GET | `/market/whatif` | Simulador (passado + cenários de futuro): valor inicial + aporte mensal + janela → valor final, lucro, ROI, anualizada (IRR), drawdown, ano a ano, comparativo CDI e cenários de futuro (12m) |
| GET | `/market/whatif-strategy` | Simulador "seguindo o agente": análises mensais com a régua do veredito (Oportunidade compra, Evitar zera) → estratégia vs compra-e-segura vs CDI, sinais e operações |
| POST | `/market/whatif-portfolio` | Simulador (passado + cenários de futuro) DIVERSIFICADO: pernas `{symbol, amount, monthly?}` → resultado por perna + total combinado + CDI |
| GET | `/finance/summary` | Caixa pessoal + empresa, reserva, disponível para investir, excedente mensal e runway |
| PATCH | `/finance/books/:id` | Atualiza caixa/reserva/label de um livro financeiro |
| POST | `/finance/books/:id/entries` | Lança receita/despesa no livro |
| GET | `/finance/books/:id/entries` | Lançamentos recentes do livro |
| DELETE | `/finance/entries/:id` | Remove lançamento |

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
| GET | `/documents` | Lista notas (com anexos) |
| POST | `/documents` | Cria nota |
| GET | `/documents/search?q=` | Busca textual |
| GET | `/documents/:id` | Detalhe |
| DELETE | `/documents/:id` | Remove (apaga anexos do disco) |
| POST | `/documents/:id/attachments` | Upload PDF/TXT/MD/CSV (8 MB, multipart `file`; texto extraído p/ o agente) |
| GET | `/documents/:id/attachments` | Lista anexos |
| GET | `/documents/:id/attachments/:attachmentId/download` | Baixa anexo |
| DELETE | `/documents/:id/attachments/:attachmentId` | Remove anexo |
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
| POST | `/analysis/contribution` | Mapa do aporte: distribui o valor priorizando a defasagem vs. meta (determinístico, sem IA) |
| POST | `/analysis/contribution/advice` | Mapa + comentário do agente com base nas dicas (gasta tokens, não é salvo) |

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
| GET | `/opportunities/radar?mode=` | Atenção + tendência + último brief do modo por tema |
| GET | `/opportunities/contrarian?limit=` | Radar contrário: papéis que caíram com sinal de virada (sobrevenda, suporte, ganho/risco) |
| GET | `/opportunities/current-cycle` | Último resumo do ciclo atual |
| POST | `/opportunities/current-cycle/refresh` | Regenera o resumo a partir de todas as análises (+ cron semanal 2ª 9h) |
| GET | `/opportunities/action-tips` | Último digest de dicas de ação |
| POST | `/opportunities/action-tips/refresh` | Gera dicas por ticker (com momentum e destaque do dia) ou por tema (+ cron semanal 2ª 9h) |
| GET | `/opportunities/action-tips/history` | Histórico por dia (últimos 30 digests) |
| GET | `/opportunities?theme=` | Briefs gerados |
| POST | `/opportunities/:theme/analyze` | Gera análise (`{ mode: growth\|conservative }`) |

## Insights de IA (`/insights`)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/insights` | Lista os insights (filtro opcional `?category=`) |
| GET | `/insights/unread-count` | Conta insights não lidos |
| POST | `/insights/refresh` | Gera novos insights (notícias + macro + carteira); poda além dos 50 recentes (`{generated, pruned}`) |
| POST | `/insights/diary` | Dicas do diário (categoria DIARIO) a partir das notas + anexos; manual, não entra no cron |
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
