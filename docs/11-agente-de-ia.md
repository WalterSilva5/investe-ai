# 11 — Agente de IA

O agente é a camada que transforma os dados do usuário em análise conversacional, **sem inventar números** e **sem executar ordens**.

## Arquitetura

```
Usuário ──> API /ai/chat ──> ProviderRegistry ──> Provedor (OpenCode/OpenAI/…)
                                 │
                                 └─> Loop de tools (até 4 passos)
                                       ├─ get_portfolio_summary
                                       ├─ get_positions / get_allocation
                                       ├─ get_macro / search_documents / search_memory
                                       ├─ simulate_fixed_income
                                       └─ project_runway / project_income / check_rebalance
                                 │
                                 └─> Resposta com citações + passos (ou streaming SSE)
```

## Provedores

Catálogo (OpenAI-compatible, um adaptador resolve a maioria):

`opencode` (padrão) · `openai` · `openrouter` · `groq` · `deepseek` · `mistral` · `together` · `gemini` · `lmstudio` · `ollama`

- Configuração por tenant (chave criptografada com AES-256-GCM).
- Teste de conexão e listagem de modelos.
- Roteamento por tarefa e fallback.
- **OpenCode** exige o header `x-opencode-session` (gerado por tenant).

## Tools (determinísticas)

| Tool | O que faz | Fonte/citação |
|---|---|---|
| `get_portfolio_summary` | patrimônio, investido, P&L, alocação | Carteira do usuário |
| `get_positions` | posições com preço médio/atual | Carteira do usuário |
| `get_allocation` | alocação por tipo e ativo | Carteira do usuário |
| `get_macro` | Selic, IPCA, CDI | BCB SGS |
| `simulate_fixed_income` | rendimento líquido de CDB/LCI/LCA/Tesouro | Cálculo determinístico |
| `project_runway` | meses que o patrimônio sustenta a despesa | Carteira do usuário |
| `project_income` | valor futuro com aportes | Cálculo determinístico |
| `check_rebalance` | desvio vs. meta | Carteira do usuário |
| `search_documents` | busca nas notas do usuário | Notas do usuário |
| `search_memory` | busca na memória do agente | Memória do agente |
| `remember` | grava uma memória | Memória do agente |

Números nunca vêm do modelo: toda tool é código determinístico no servidor, e a resposta cita **fonte + data**.

## Memória do agente

- `Memory` (kind: `fact|decision|preference|episode|procedure|context` + importância 1–10).
- As memórias mais importantes são injetadas como contexto em toda conversa.
- O agente pode gravar (`remember`) e buscar (`search_memory`) por iniciativa própria.

## Streaming

- `POST /ai/chat/stream` (SSE): `meta` → `delta`* → `done`.
- As tools são resolvidas antes e a resposta final é transmitida token a token.
- Fallback automático para o endpoint não-streaming.

## Guardrails

- Não executa ordens; não recomenda compra/venda; não prevê preço; não promete retorno.
- Tool allowlist (o modelo não faz chamadas arbitrárias).
- Toda resposta inclui disclaimer.
- Auditoria de pergunta, tools, modelo, tokens e custo.

## Quota e uso

- `AI_MONTHLY_TOKEN_QUOTA` por usuário (0 = ilimitado).
- `GET /ai/usage` devolve usado, quota, restante e reset.
- Ao atingir a quota, o chat responde **429**.

## Teste determinístico

`POST /ai/tools/:name` (auth + tenant) executa a tool sem LLM — útil para validar dados e para depurar.

## Configuração (env)

```env
AI_DEFAULT_PROVIDER=opencode
OPENCODE_API_KEY=
OPENCODE_MODEL=deepseek-v4-pro
OPENCODE_BASE_URL=https://opencode.ai/zen/go/v1
AI_ENCRYPTION_KEY=
AI_MAX_TOKENS_PER_REQUEST=4096
AI_MONTHLY_TOKEN_QUOTA=200000
```

## Avaliação (pendente)

Conjunto dourado de perguntas, consistência numérica e testes de recusa ainda não automatizados — a incluir no roadmap.
