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
| `create_note` | salva anotação no Diário | Diário do usuário |
| `get_stock_outlook` | leitura técnica de qualquer ticker (tendência, RSI, níveis, ganho/risco) | brapi/CoinGecko/Yahoo |
| `track_symbol` | cadastra o papel na watchlist de Descobertas (nota completada com números reais) | Watchlist |
| `verify_tools` | lista as tools do perfil (autodescoberta) | Catálogo do agente |
| `search_memory` | busca na memória do agente | Memória do agente |
| `remember` | grava uma memória | Memória do agente |
| `get_briefing` | contexto geral: carteira + macro + dicas recentes + não lidas | Carteira + macro + dicas de IA |
| `get_insights` | dicas recentes de IA, com filtro por categoria | Dicas de IA |
| `web_search` | pesquisa rápida na internet (resumos + links) | DuckDuckGo |
| `fetch_page` | lê o texto de página pública (anti-SSRF, 12k chars) | Página citada |

Números nunca vêm do modelo: toda tool é código determinístico no servidor, e a resposta cita **fonte + data**.

## Memória do agente

- `Memory` (kind: `fact|decision|preference|episode|procedure|context` + importância 1–10).
- As memórias mais importantes são injetadas como contexto em toda conversa.
- O agente pode gravar (`remember`) e buscar (`search_memory`) por iniciativa própria.

## Imagens no chat

Anexar (botão 📎) ou colar (Ctrl+V) uma imagem junto à mensagem (`image` como data URL, máx ~3 MB). Quatro caminhos, em ordem de preferência:

1. **Modelo com visão nativa** (heurística de nomes + `AI_VISION_MODELS`): a imagem vai embutida no conteúdo multimodal.
2. **Duas etapas**: sem visão nativa, `AI_VISION_MODEL` (ex.: `claude-haiku-5-5` no gateway) descreve a imagem (textos, números, gráfico) e a descrição vira contexto de texto para o agente.
3. **OCR local**: sem modelo de visão, `tesseract -l por` extrai o texto.
4. **Sem nada disso**: o agente informa que não pode ler a imagem (em vez de inventar).

A imagem não é persistida no histórico — só a mensagem e a descrição. O anexo funciona na página do chat (não no widget flutuante).

## Compactação de sessão
- A cada **6 mensagens novas**, a sessão é compactada: o agente resume o trecho novo junto ao resumo anterior (`conversation.summary` + `summaryCount`).
- Com resumo ativo, o contexto passa a ser **resumo + últimas 6 mensagens** (em vez do histórico cheio) — economia crescente de tokens em conversas longas.
- Best-effort: falha na compactação nunca quebra o chat.

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
`GET /ai/tools?profile=<id>` lista as tools disponíveis no perfil (nome + descrição) — o chat exibe como "ferramentas".

## Postura da resposta

- **Análise de ativo é obrigatória**: pergunta sobre ticker/empresa/BDR → `get_stock_outlook` antes de responder, tentando a variante (NU ↔ ROXO34, PETR4 ↔ PBR). A resposta traz tendência, RSI, médias, suporte/resistência, ganho/risco, histórico do padrão, gatilho de melhora e o que invalidaria a leitura.
- **Sem hedge vazio**: se os números mostram cenário desfavorável, o agente diz isso; se o ganho/risco é bom mas o histórico é fraco, ele separa as duas coisas.
- **Aprendizado no contexto**: as taxas de acerto medidas das regras entram como contexto e podem ser citadas.
- Limite mantido: sem recomendação explícita de compra/venda, sem previsão de preço, com **uma** linha de aviso ao final.

## Prompt registry (versões e avaliação)
- Os prompts de perfil deixaram de ser só código: ficam em `AgentPrompt`, com versões e status (`active`, `candidate`, `archived`). O chat usa a **ativa** (`prompt vN` aparece no system prompt); o código é semente (v1) e fallback.
- Tela **Prompts do agente** (`/app/prompts`): ver versões, criar candidato, avaliar e ativar (com confirmação).
- **Eval harness** (`prompt-eval.ts`): 5 casos dourados (NU, alocação, CDB vs LCI, ciclo do BTC, risco fiscal) com checagens objetivas — resposta completa, números, fonte, tool esperada, aviso único, sem promessa futura, sem frase proibida. Nota 0–100 salva em `AgentPrompt.evalScore` e em `PromptEvalRun`.
- Ativação é humana e compara com o **baseline** da versão ativa; a avaliação custa tokens e roda sob demanda.
- **Auto-ajuste (L5)**: cron dias úteis 7h (`PROMPT_AUTO_TUNE`, default true) ou `POST /prompts/tune`. O agente lê as falhas medidas (casos dourados + hit rate das regras), **redige um candidato**, avalia e só promove se superar o baseline com **margem +5** e checks críticos (tool/proibida/promessa) OK. Todo resultado vira um Insight para revisão; o anterior fica arquivado.
- **Swarm**: `POST /prompts/swarm` (e cron toda segunda 7h) roda o ciclo para **todos os perfis em paralelo** (concância 2) com relatório único; o diário (ter–sex) roda um perfil por dia por rotação.

## Streaming, parada e raciocínio

- `POST /ai/chat/stream` (SSE): `meta` (com `steps`: tool, status, duração e inputs) → `delta`* → `done`.
- O front tem botão **Parar**: aborta o fetch; o back detecta o disconnect, interrompe o loop e **não persiste** a resposta parcial (evento `aborted`).
- O chat mostra o **Raciocínio** expansível por mensagem (ferramentas usadas, tempo e inputs).

## Ferramentas do agente

Além das ferramentas de carteira, macro e criação de notas, o agente tem (perfis "geral" e "planejador"):

- `get_cash_position` — caixa pessoal + empresa, reserva, disponível, excedente mensal, runway.
- `compare_assets` — 2-4 ativos na mesma régua (tendência, score, RSI, ganho/risco, vol) e o cenário mais/menos favorável do conjunto.
- `correlation` — correlação de retornos semanais (12 meses) entre 2-5 ativos, com classificação (alta = mesma tese; baixa/negativa = diversificação real).
- `portfolio_backtest` — retrospectiva de uma alocação proposta (pesos fixos, 3-60 meses): retorno total/anualizado, vol, drawdown máximo, melhor/pior mês e retorno individual de cada componente.
- `add_finance_entry` / `update_cash` — o agente registra receita/despesa e atualiza caixa/reserva pelo próprio chat.
- `whatif_investment` — simulador de passado: "se eu tivesse investido R$ X há N anos em SYMBOL" → valor final, lucro, ROI, anualizada, drawdown, ano a ano e comparativo com o CDI real do período (série diária do BCB). Mesma conta da página **Simulador de passado** (`/app/whatif`).
- `whatif_portfolio` — simulador de passado DIVERSIFICADO: pernas `{symbol, amount, monthly?}` → resultado por perna + total combinado por data em comum + CDI. Usado pelo chat embutido na página do simulador ("simule R$ 1.000 em PETR4 e R$ 2.000 em IVVB11 há 5 anos").
- `whatif_strategy` — simulador "SEGUINDO O AGENTE": análises mensais no passado com a MESMA régua do veredito atual (Oportunidade = score ≥ 65 e ganho/risco ≥ 1,2 → investe o caixa; Evitar = score ≤ 35 ou baixa sem relação → zera a posição; Aguardar → mantém). Compara com compra-e-segura e CDI no mesmo fluxo. A régua vive em `market/indicators.ts` (fonte única usada pelo outlook e pelo simulador).
- `analyze_chart` — análise técnica completa do gráfico: TODOS os suportes/resistências da janela de 12 meses (com distância %), MM20/50/200 + cruzamento dourado/morte, RSI (mesma metodologia Wilder do app), MACD (linha, sinal, histograma, cruzamento recente), Bollinger (%B), estrutura de topos/fundos e posição vs 52 semanas. Matemática pura em `market/chart.ts`.
- Anualizada correta com aportes mensais: **IRR** (cada aporte descontado no mês em que entrou) — a fórmula simples inflava o número.

A matemática (alinhamento de séries, Pearson, backtest de pesos, juros compostos do CDI) é pura e testada (`ai/tool-math.ts`, `market/whatif.ts`).

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

## Simulações: prompts por classe de ativo

O módulo de prompts tem um **backtest** (`/prompts/sim/*`, página Prompts do agente) que mede qual
instrução de sistema prevê melhor a direção futura por **classe de ativo** (banco, commodity,
tecnologia, consumo, industrial, juros-sensível, cripto, ETF):

1. Pega 2 anos de histórico (cripto: 1 ano) e escolhe âncoras espaçadas no passado.
2. Em cada âncora, reconstrói o gráfico COMO ESTAVA (preço, médias, RSI, níveis, amplitude típica
   de 20 pregões) e pede uma leitura direcional ao LLM com cada variante:
   `base` (controle sem setor), `classe` (enquadra o que move esse tipo de ativo) e
   `classe-rigor` (classe + regras de confirmação de direção).
3. Compara a chamada com o retorno REALIZADO nos 20 pregões seguintes — banda "lateral" proporcional
   à volatilidade do próprio ativo (±2,5% no mínimo, e metade da amplitude típica).
4. Nota por variante: taxa de acerto menos penalidade por erro confiante. A variante vencedora de
   cada classe entra automaticamente na análise de chat (`get_stock_outlook` retorna `assetClass`
   com o framing vencedor).

Leitura honesta do resultado: amostra pequena por classe (12 chamadas) — é calibragem de prompt,
não edge estatístico.

## Avaliação (pendente)

Conjunto dourado de perguntas, consistência numérica e testes de recusa ainda não automatizados — a incluir no roadmap.
