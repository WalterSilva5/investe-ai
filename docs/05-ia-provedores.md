# 05 — IA e provedores

## Objetivo

Permitir que o mesmo agente funcione com **qualquer provedor** que o usuário tenha disponível, começando pelo **OpenCode**, sem reescrever a lógica de negócio.

## Arquitetura

```
AIProviderRegistry
├── OpenAICompatibleAdapter   (OpenCode, OpenAI, OpenRouter, Groq,
│                              DeepSeek, Mistral, Together, Gemini,
│                              LM Studio, Ollama)
├── AnthropicAdapter          (opcional)
└── VertexAdapter             (opcional)
```

### Interface

```ts
interface IAIProvider {
  id: string;
  chat(req: ChatRequest): Promise<ChatResponse>;
  stream(req: ChatRequest): AsyncIterable<ChatChunk>;
  listModels(): Promise<string[]>;
  testConnection(): Promise<{ ok: boolean; message: string }>;
  supportsTools: boolean;
  supportsStreaming: boolean;
}
```

## Provedores (catálogo)

| id | Base URL | Modelo padrão | Observação |
|---|---|---|---|
| `opencode` | `https://opencode.ai/zen/go/v1` | `deepseek-v4-pro` | **Foco inicial**; header `x-opencode-session` |
| `openai` | `https://api.openai.com/v1` | `gpt-4o-mini` | — |
| `openrouter` | `https://openrouter.ai/api/v1` | — | Muitos modelos |
| `groq` | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` | Rápido |
| `deepseek` | `https://api.deepseek.com/v1` | `deepseek-chat` | — |
| `mistral` | `https://api.mistral.ai/v1` | `mistral-large-latest` | — |
| `together` | `https://api.together.xyz/v1` | — | — |
| `gemini` | `https://generativelanguage.googleapis.com/v1beta/openai` | `gemini-2.0-flash` | Compatível OpenAI |
| `lmstudio` | `http://localhost:1234/v1` | — | Local |
| `ollama` | `http://localhost:11434/v1` | — | Local |
| `anthropic` | API nativa | — | Opcional |
| `vertexai` | API nativa | — | Opcional |

O catálogo é semeado no banco e editável na tela de configurações.

## Configuração

- **Por usuário/tenant:** chave (criptografada), base URL, modelo padrão.
- **Por agente:** override de provedor/modelo/temperatura/tokens.
- **Chave da plataforma:** usada no plano free com quota; **BYOK** para usuários avançados.
- Testar conexão e listar modelos antes de salvar.
- Nunca logar chave; mascarar na UI.

## Roteamento

| Tarefa | Sugestão |
|---|---|
| Chat curto | modelo barato/rápido |
| Análise profunda | modelo maior |
| Extração/classificação | modelo pequeno/local |
| Embeddings | provedor com embeddings |

Regras:
1. Provedor escolhido pelo usuário, se configurado.
2. Fallback para o próximo disponível.
3. Limite de tokens/custo por chamada.
4. Cache de respostas não sensíveis (opcional).

## Uso e quota

- `AiUsage` registra tokens, custo, latência, tarefa.
- `AiUsageService` soma tokens do mês por usuário.
- Quota mensal via `AI_MONTHLY_TOKEN_QUOTA` (0 = sem limite).
- `GET /api/ai/usage` devolve usado, quota, restante e reset.
- Ao atingir a quota, o chat responde **429** com mensagem clara.
- Painel de uso na visão geral.

## Agente e tools

**Streaming:** `POST /api/ai/chat/stream` devolve SSE (`meta` → `delta`* → `done`), executando as tools antes e transmitindo a resposta final. Fallback automático para `POST /api/ai/chat` se o provedor não suportar streaming.

**Tools implementadas (determinísticas):**
- `get_portfolio_summary` — patrimônio, investido, resultado, alocação
- `get_positions` — posições da carteira
- `get_allocation` — alocação por tipo e por ativo
- `get_macro` — Selic, IPCA e CDI (BCB)
- `simulate_fixed_income` — CDB/LCI/LCA/Tesouro com IR/isenção

**Fluxo:** pergunta → LLM escolhe tools → execução no servidor → LLM redige com os números retornados → resposta com **fontes/data**.

- Limite de 4 passos de tool calling por resposta.
- Se o provedor não suportar tools, há fallback para resposta com contexto injetado.
- Cada execução é registrada em `ToolCall` (input/output/duração).
- Citações são persistidas em `Message.citations` e devolvidas na API.

**Teste determinístico:** `POST /api/ai/tools/:name` (auth + tenant) executa a ferramenta sem LLM.

## Insights periódicos

Dicas geradas por IA a partir de **dados obtidos online**, sem intervenção do usuário:

- **Entradas:** macro (Selic/IPCA/CDI via BCB) + cotações/carteira + **manchetes de notícias via RSS** (InfoMoney, Exame, Agência Brasil, CoinDesk, The Block; lista configurável em `INSIGHT_NEWS_FEEDS`).
- **Geração:** o provedor configurado produz de 3 a 5 insights com categoria (`MACRO`, `RENDA_FIXA`, `ACOES`, `CRIPTO`, `CARTEIRA`), título, texto e **fontes** (links das notícias usadas).
- **Cadência:** cron diário (dias úteis 8h, `ENABLE_CRON`) + gatilho manual `POST /api/insights/refresh`.
- **Notificação:** badge de não lidos na barra lateral + painel dedicado com filtro por categoria; digest por **e-mail** (via SMTP, opcional em `SMTP_*`) enviado no cron aos membros `OWNER`/`ADMIN`.
- **Guarda:** mesmo conjunto de regras do chat (sem recomendação de compra/venda, sem prever preço, tom educacional); resposta validada como JSON e persistida em `Insight`.

## Guardrails

- **Não executa ordens.**
- **Não prevê preço.**
- **Não promete retorno.**
- Toda resposta com fonte/data e disclaimer.
- Tool allowlist; sem HTTP arbitrário do modelo.
- Validação de números: todo valor citado deve vir de tool.
- Auditoria de pergunta, tools, modelo, tokens e custo.

## Avaliação

- Conjunto dourado de perguntas (alocação, renda fixa, runway, cenário).
- Checagem de consistência numérica contra o banco.
- Testes de recusa (pedido de compra/venda, previsão, conselho personalizado).
- Regressão a cada troca de modelo/prompt.

## Variáveis de ambiente

```env
AI_DEFAULT_PROVIDER=opencode
OPENCODE_API_KEY=
OPENCODE_MODEL=deepseek-v4-pro
OPENCODE_BASE_URL=https://opencode.ai/zen/go/v1
AI_ENCRYPTION_KEY=            # 32 bytes em base64
AI_MAX_TOKENS_PER_REQUEST=4096
AI_MONTHLY_TOKEN_QUOTA=200000
```

## Privacidade

- Dados enviados ao provedor: pergunta + contexto mínimo necessário.
- Não enviar chaves, senhas ou dados de outro tenant.
- Usuário pode escolher provedor local para manter tudo na máquina.
