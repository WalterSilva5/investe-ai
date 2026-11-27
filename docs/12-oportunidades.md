# 12 — Radar de oportunidades

## Objetivo

Ajudar o investidor a **entender narrativas e ciclos de mercado** — tech (IA, cripto, semicondutores) e economia real (agro, bancos, FIIs, petróleo/mineração, consumo, saúde, energia, defesa) — separando **fato de hype** e identificando **risco e estágio do ciclo**.

> **Enquadramento ético:** a ferramenta serve para **o investidor se proteger** e agir com critério. **Não** é para explorar a ignorância de outros investidores, manipular preços ou "vender sonho". O app não recomenda compra/venda e não prevê preço.

## O que é (e o que não é)

**É:**
- Um radar de **atenção** (quantas manchetes do tema aparecem no noticiário).
- Uma leitura de **estágio de ciclo** (hype → desilusão → maturação).
- Um mapa de **riscos, sinais de confirmação/invalidação e regras de saída**.
- Conteúdo **educacional**, com fontes.

**Não é:**
- Sinal de compra/venda.
- Previsão de preço.
- Recomendação personalizada.
- Ferramenta para "aproveitar" investidores desinformados.

## O ciclo de hype (referência)

| Estágio | O que costuma acontecer | Leitura |
|---|---|---|
| **Emergente** | Tecnologia/tema novo, pouca gente fala | Maior assimetria, maior incerteza |
| **Hype** | Atenção explode, preços e promessas sobem | Risco de comprar no topo |
| **Desilusão** | Expectativa frustrada, preço cai, mídia esfria | Pode ser oportunidade — se o fundamento existir |
| **Maturação** | Casos de uso reais, receita aparece | Menos euforia, mais fundamento |
| **Platô** | Tema consolidado, crescimento menor | Retorno mais "normal" |
| **Declínio** | Tema perde relevância | Evitar "value trap" |

## Como o radar calcula

- **Atenção:** número de manchetes (RSS) que casam com as palavras-chave do tema.
- **Hype risk (0–100):** heurística que combina atenção + volatilidade recente (quando o tema tem cripto). É um **indicador de risco**, não uma previsão.
- **Estágio:** definido pela análise de IA a partir do contexto (manchetes, macro, dados de mercado).
- **Termômetro (por card):** separa **força do tema** (score 0–100: estágio ±, tendência ×4, atenção até +5, hype −0,25/ponto; ≥70 Forte, 40–69 Neutro, <40 Fraco) da **leitura** (Bullish/Neutro/Bearish: com análise, HYPE/declínio/desilusão → Bearish, tendência ≥+3 ou EMERGENTE → Bullish, tendência ≤−3 → Bearish; sem análise, a tendência manda: ≥+2 Bullish, ≤−2 Bearish). Cada card traz também uma **dica curta** ("acompanhar de perto", "aguardar virada", "risco de topo"). Setor forte + leitura fraca = **divergência: cautela com o tema**.

## Radar contrário (quedas com sinal de virada)

Cada item do radar contrário vem com o bloco **"📊 Seguindo o agente (24 meses)"**: backtest mensal do papel com a mesma régua do veredito (`indicators.agentSignal`), comparando agente × compra-e-segura × CDI no mesmo fluxo de caixa (cache de 12h; ver `opportunities.service.simulateFor`). Dicas de ação (`action-tips`) também recebem o bloco quando têm ticker.
- Varre o universo da descoberta + posições da carteira e calcula uma **nota de reversão (0–100)**: RSI em sobrevenda (+30), proximidade do suporte (+20), ganho/risco (+20), repique no dia (+10), queda de 10%+ em 3 meses (+10), mês melhor que o trimestre (+8) e recuperação da MM20 (+8).
- Papel já em tendência de alta forte ou esticado (RSI > 60) **não entra** — o foco é o que caiu, não o que já subiu.
- Vereditos: `Reversão forte` (≥60), `Reversão em formação` (40–59), `Aguardar` (25–39); abaixo disso não aparece.
- A lista mostra queda em 3m, RSI, distância do suporte, ganho/risco e os motivos, com atalho para salvar na watchlist ou abrir no Tracking.

## Ciclo do halving (BTC)

- Calcula, na data atual, os dias desde o último halving e até o próximo (estimado, ~210 mil blocos).
- Fases: pós-halving imediato → expansão → bull run/topo histórico (380–550 dias após) → distribuição → bear; a **≤600 dias do próximo halving** a fase é "pré-halving (zona histórica de acumulação)".
- Em 27/11/2026: **~505 dias** para o próximo halving, fase de acumulação — os fundos de 2016, 2020 e 2024 ocorreram ~500 dias antes do halving (padrão observado, não garantia).
- O contexto entra no outlook de BTC/ETH (Tracking e tool `get_stock_outlook` do chat) com a tabela de referência dos ciclos.

## Vidente de dicas (análise geral)

- Varre o universo (B3, EUA e cripto), identifica o **padrão que cada papel vive agora** (teste de suporte, RSI em sobrevenda ou cruzamento da MM50) e puxa o histórico desse padrão no próprio papel.
- **Nota 0–100**: acerto suavizado (Laplace) + retorno médio em 10 pregões + ajuste pelo veredito atual (Oportunidade +10, Evitar −15). Só entra com **8+ casos**.
- Ordena o ranking e mostra **qual padrão tem funcionado melhor no universo** (acerto ponderado e retorno médio em 10/20 pregões).
- Atalhos para abrir no Tracking ou salvar na watchlist. Amostra pequena não entra — evita "vidente" com 3 casos.

## Dicas de ação (postura de conselho)
- Cada dica vem com **veredito** (`Oportunidade`, `Aguardar`, `Evitar`), **gatilho de confirmação** e **o que invalida** a leitura, além dos números que a sustentam.
- Linguagem de conselho, não de ordem: "faz sentido aumentar aos poucos", "não é hora de entrar", "realizar parcial é razoável".
- Com posições, as dicas são por ticker (momentum, distância de suporte/média, resultado); sem carteira, por tema (atenção, tendência, hype).
- Mantém-se o marco educacional: sem previsão de preço e sem promessa de retorno.

## Modos de análise

| Modo | Foco |
|---|---|
| **Crescimento máximo** (padrão) | Assimetria upside/downside, momentum, entrada cedo, sinais de euforia/topo, dimensionamento de risco e saída disciplinada |
| **Conservador** | Fundamentos, valuation, margem de segurança e risco de perda permanente |

Ambos mantêm os mesmos limites: sem recomendação de compra/venda, sem preço-alvo, sem previsão e **sem manipulação/fraude**.

## Guardrails da análise

- Não recomenda compra/venda nem dá preço-alvo.
- Não prevê preço.
- Não sugere manipulação, fraude, notícia falsa, pump-and-dump ou insider trading.
- Separa fato de narrativa.
- Aponta sinais de confirmação, invalidação, euforia/topo e regras de saída.
- Explica como o hype/manipulação costuma funcionar.
- Inclui disclaimer educacional.

## Rotação de narrativa (tendência)

- A cada dia, o radar registra um **snapshot de atenção** por tema (global, a partir das manchetes).
- A **tendência** compara o primeiro snapshot da janela de 7 dias com o mais recente: `↑` atenção subindo, `↓` esfriando.
- Serve para perceber **rotação** (um tema esfriando enquanto outro emerge) — não para prever preço.

## Ciclos passados (lições)

Catálogo educacional com ciclos históricos (cripto 2017/2021, NFTs, metaverso, IA, bolha ponto-com): resumo, **sinais de alerta** e **lições**. O objetivo é reconhecer padrões de euforia e queda.

## Playbook de saída (disciplina)

Framework educacional exibido no painel:

- **Tamanho da posição:** risco máximo por posição e teto por tema.
- **Take profit parcial:** realizar parte quando a tese se materializa.
- **Trailing stop:** subir o ponto de saída conforme o preço sobe.
- **Invalidação da tese:** sair quando o sinal que confirmava a tese desaparece.
- **Prazo:** definir prazo e reavaliar.
- **Emoção:** não aumentar posição no prejuízo; não vender tudo no pânico.

## Como usar

1. Abra **Radar de oportunidades**.
2. Veja a atenção e o hype risk de cada tema.
3. Clique em **Analisar tema** (exige provedor de IA configurado).
4. Leia: evidências, riscos, sinais de confirmação/invalidação e regras de saída.
5. **Não** trate como recomendação — trate como **mapa de risco**.

## Limitações

- Heurísticas são simplificações; não substituem análise profissional.
- Manchetes podem ser enviesadas ou incompletas.
- A análise de IA pode errar; confirme em fontes primárias.
- O passado não garante o futuro.
- Tema com "potencial" não é tema com "futuro": muitos produtos fracassam mesmo com preço tendo subido no ciclo.

## API

| Método | Rota | Descrição |
|---|---|---|
| GET | `/opportunities/themes` | Catálogo de temas |
| GET | `/opportunities/cycles` | Ciclos históricos e lições |
| GET | `/opportunities/radar` | Atenção + tendência + último brief por tema |
| GET | `/opportunities?theme=` | Briefs gerados |
| POST | `/opportunities/:theme/analyze` | Gera análise do tema (`{ mode: growth\|conservative }`) |

## Referências

- Ciclo de hype (Gartner) — conceito geral.
- Psicologia do investidor: vieses de manada, FOMO, ancoragem.
- Fontes primárias: Receita Federal, BCB, B3, CVM.
