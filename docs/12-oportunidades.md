# 12 — Radar de oportunidades

## Objetivo

Ajudar o investidor a **entender narrativas e ciclos de mercado** (IA, cripto, metaverso, NFTs, semicondutores, energia etc.) — separando **fato de hype** e identificando **risco e estágio do ciclo**.

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
| GET | `/opportunities/radar` | Atenção + último brief por tema |
| GET | `/opportunities?theme=` | Briefs gerados |
| POST | `/opportunities/:theme/analyze` | Gera análise do tema |

## Referências

- Ciclo de hype (Gartner) — conceito geral.
- Psicologia do investidor: vieses de manada, FOMO, ancoragem.
- Fontes primárias: Receita Federal, BCB, B3, CVM.
