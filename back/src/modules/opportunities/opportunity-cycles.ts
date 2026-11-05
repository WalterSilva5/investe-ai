export interface OpportunityCycle {
  id: string;
  theme: string;
  period: string;
  title: string;
  summary: string;
  warningSigns: string[];
  lessons: string[];
}

/**
 * Lições de ciclos passados. Conteúdo educacional: o objetivo é reconhecer
 * padrões de euforia e queda — não prever o próximo ciclo.
 */
export const OPPORTUNITY_CYCLES: OpportunityCycle[] = [
  {
    id: 'cripto-2017',
    theme: 'Cripto',
    period: '2017–2018',
    title: 'Bitcoin: euforia de 2017 e queda de ~80%',
    summary:
      'O Bitcoin saiu de ~US$ 1 mil para perto de US$ 20 mil no fim de 2017, com entrada massiva de pessoa física. Em 2018, caiu ~80% e o noticiário esfriou por anos.',
    warningSigns: [
      'Mídia mainstream e conversas de elevador sobre "ficar rico".',
      'Entrada de quem nunca tinha investido.',
      'Promessas de retorno rápido e ICOs sem produto.',
    ],
    lessons: [
      'Atenção explodindo costuma marcar euforia, não início.',
      'Quem entrou no topo levou anos para recuperar (nominal).',
      'Quem dimensionou posição pequena sobreviveu ao ciclo.',
    ],
  },
  {
    id: 'cripto-2021',
    theme: 'Cripto',
    period: '2020–2022',
    title: 'Ciclo de 2021, LUNA e o inverno cripto',
    summary:
      'Estímulos e liquidez levaram o Bitcoin a ~US$ 69 mil em 2021. Em 2022, a queda foi ~77%, agravada pelo colapso do LUNA/UST e por corretoras que quebraram.',
    warningSigns: [
      'Rendimento "garantido" alto em stablecoins (20%+).',
      'Projetos sem receita com market cap bilionário.',
      'Alavancagem e "yield farming" como norma.',
    ],
    lessons: [
      'Rendimento alto "garantido" é risco de crédito disfarçado.',
      'Custódia importa: corretora que quebra leva seu saldo.',
      'O ciclo não avisa quando vira; a disciplina de tamanho protege.',
    ],
  },
  {
    id: 'nft-2021',
    theme: 'NFTs',
    period: '2021–2022',
    title: 'NFTs: do hype ao volume secando',
    summary:
      'Coleções digitais atingiram preços altíssimos em 2021. Depois, o volume de negociação caiu drasticamente e muitos colecionáveis perderam liquidez quase total.',
    warningSigns: [
      'Preço subindo por "community" e escassez, sem fluxo de caixa.',
      'Poucos compradores e muitos vendedores no secundário.',
      'Royalties e promessas de utilidade futura.',
    ],
    lessons: [
      'Ativo sem fluxo de caixa depende 100% de demanda futura.',
      'Liquidez some exatamente quando você quer vender.',
      'Hype cultural pode ser real e, ainda assim, não ser investimento.',
    ],
  },
  {
    id: 'metaverso-2021',
    theme: 'Metaverso',
    period: '2021–2023',
    title: 'Metaverso: rebrand, euforia e esfriamento',
    summary:
      'Em 2021, o metaverso virou prioridade de grandes empresas. Dois anos depois, investimentos foram cortados e o tema saiu do centro do noticiário.',
    warningSigns: [
      'Rebrand de empresa como sinal de tese (não de receita).',
      'Adoção medida em "mundos criados", não em usuários ativos.',
      'Capex alto sem monetização clara.',
    ],
    lessons: [
      'Narrativa de empresa não substitui receita.',
      'Tema pode "esfriar" por anos antes de amadurecer.',
      'Quem entrou no anúncio e saiu no silêncio perdeu.',
    ],
  },
  {
    id: 'ia-2023',
    theme: 'Inteligência Artificial',
    period: '2023–…',
    title: 'IA: a narrativa que virou capex real',
    summary:
      'Após o ChatGPT, a IA virou o tema dominante. Diferente de ciclos anteriores, houve receita real (chips, nuvem), mas também valuation esticado e "AI washing".',
    warningSigns: [
      'Toda empresa vira "de IA" sem produto.',
      'Crescimento precificado por muitos anos à frente.',
      'Concentração em poucos fornecedores (chips).',
    ],
    lessons: [
      'Narrativa com receita real é diferente de narrativa pura.',
      'Mesmo tema bom pode ter entrada ruim (valuation).',
      'Diversificar dentro do tema reduz o risco de "vencedor único".',
    ],
  },
  {
    id: 'dotcom-2000',
    theme: 'Internet',
    period: '1999–2002',
    title: 'Bolha da internet: o clássico',
    summary:
      'Empresas ".com" sem lucro atingiram valuations enormes. O Nasdaq caiu ~78% entre 2000 e 2002; muitas empresas sumiram, mas a internet transformou a economia.',
    warningSigns: [
      'Valuation sem lucro nem receita.',
      'Métrica inventada para justificar preço ("page views").',
      'IPO de empresa jovem com enorme valor de mercado.',
    ],
    lessons: [
      'A tecnologia pode vencer e os investidores perderem.',
      'Preço de entrada importa tanto quanto a tese.',
      'Sobreviver ao ciclo é pré-requisito para capturar o longo prazo.',
    ],
  },
];
