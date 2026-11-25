export interface OpportunityTheme {
  slug: string;
  name: string;
  icon: string;
  description: string;
  keywords: string[];
  cryptoIds?: string[];
  assets?: string[];
  questions: string[];
}

/**
 * Catálogo de narrativas/temas. O objetivo é analisar o ESTÁGIO do ciclo e o
 * RISCO — não recomendar compra/venda. As perguntas-guia orientam a leitura.
 */
export const OPPORTUNITY_THEMES: OpportunityTheme[] = [
  {
    slug: 'ia',
    name: 'Inteligência Artificial',
    icon: '🤖',
    description: 'Modelos de linguagem, chips, data centers e aplicações de IA.',
    keywords: ['inteligência artificial', 'inteligencia artificial', 'ia ', ' ai ', 'chatgpt', 'openai', 'llm', 'modelo de linguagem', 'nvidia', 'data center', 'agente de ia'],
    assets: ['NVDA', 'MSFT', 'GOOGL', 'B3: tecnologia'],
    questions: [
      'A receita já existe ou é só expectativa?',
      'Quem realmente ganha dinheiro (chips, nuvem, aplicação)?',
      'O valuation já embutiu anos de crescimento?',
    ],
  },
  {
    slug: 'cripto',
    name: 'Cripto / Bitcoin',
    icon: '₿',
    description: 'Bitcoin, Ethereum, ETFs, halving e ciclos de liquidez.',
    keywords: ['bitcoin', 'btc', 'cripto', 'criptomoeda', 'ethereum', 'blockchain', 'halving', 'etf de bitcoin', 'exchange'],
    cryptoIds: ['bitcoin', 'ethereum'],
    assets: ['BTC', 'ETH'],
    questions: [
      'O ciclo está em expansão ou em euforia?',
      'O que sustenta o preço (liquidez, fluxo de ETF, adoção)?',
      'Qual o drawdown histórico e a tolerância a ele?',
    ],
  },
  {
    slug: 'metaverso',
    name: 'Metaverso / XR',
    icon: '🕶️',
    description: 'Realidade virtual/aumentada, óculos e mundos digitais.',
    keywords: ['metaverso', 'realidade virtual', 'realidade aumentada', 'óculos', 'oculos', 'vr ', ' ar ', 'xr', 'mundos digitais'],
    assets: ['META', 'B3: tecnologia'],
    questions: [
      'A adoção saiu do nicho?',
      'Quem monetiza de verdade (hardware, software, conteúdo)?',
      'O hype de 2021 se repetiu ou o tema esfriou?',
    ],
  },
  {
    slug: 'nft',
    name: 'NFTs / Colecionáveis digitais',
    icon: '🖼️',
    description: 'Tokens não fungíveis, arte digital e colecionáveis.',
    keywords: ['nft', 'colecionável digital', 'colecionavel digital', 'token não fungível', 'token nao fungivel', 'arte digital', 'opensea'],
    cryptoIds: ['ethereum'],
    assets: ['ETH'],
    questions: [
      'O volume de negociação está crescendo ou secando?',
      'O valor é cultural/colecionável ou puramente especulativo?',
      'Qual o risco de liquidez (conseguir vender)?',
    ],
  },
  {
    slug: 'web3',
    name: 'Web3 / tokenização',
    icon: '🌐',
    description: 'DeFi, stablecoins, tokenização de ativos e infraestrutura.',
    keywords: ['web3', 'defi', 'tokenização', 'tokenizacao', 'stablecoin', 'smart contract', 'contrato inteligente', 'dao'],
    cryptoIds: ['ethereum', 'solana'],
    assets: ['ETH', 'SOL'],
    questions: [
      'Há receita real ou só incentivo/token?',
      'O risco regulatório é conhecido?',
      'A infraestrutura é usada por quem, além de especuladores?',
    ],
  },
  {
    slug: 'semicondutores',
    name: 'Semicondutores',
    icon: '🔌',
    description: 'Chips, foundries e a cadeia de suprimentos da IA.',
    keywords: ['semicondutor', 'chip', 'foundry', 'tsmc', 'memória', 'memoria', 'gpu', 'litografia'],
    assets: ['TSM', 'NVDA', 'ASML'],
    questions: [
      'O ciclo de chips está em alta ou em excesso de oferta?',
      'Quem tem poder de precificação?',
      'A demanda de IA é real ou estoque especulativo?',
    ],
  },
  {
    slug: 'energia',
    name: 'Transição energética',
    icon: '⚡',
    description: 'Solar, eólica, baterias, hidrogênio e rede elétrica.',
    keywords: ['energia solar', 'energia eólica', 'energia eolica', 'bateria', 'hidrogênio verde', 'hidrogenio verde', 'transição energética', 'transicao energetica', 'rede elétrica'],
    assets: ['B3: utilities', 'ENPH', 'FSLR'],
    questions: [
      'A tese depende de subsídio?',
      'O custo por kWh já é competitivo?',
      'Quem sobrevive a um ciclo de juros altos?',
    ],
  },
  {
    slug: 'defesa',
    name: 'Defesa e aeroespacial',
    icon: '🛡️',
    description: 'Defesa, drones, satélites e geopolítica.',
    keywords: ['defesa', 'aeroespacial', 'drone', 'míssil', 'missil', 'satélite', 'satelite', 'geopolítica', 'geopolitica'],
    assets: ['LMT', 'RTX', 'B3: defesa'],
    questions: [
      'O orçamento é recorrente ou pontual?',
      'A tese depende de um conflito específico?',
      'Qual o risco político/regulatório?',
    ],
  },
  {
    slug: 'saude',
    name: 'Saúde e biotech',
    icon: '🧬',
    description: 'GLP-1, biotech, medicamentos e longevidade.',
    keywords: ['biotech', 'glp-1', 'glp1', 'obesidade', 'farmacêutica', 'farmaceutica', 'medicamento', 'longevidade', 'biotecnologia'],
    assets: ['LLY', 'NVO', 'B3: saúde'],
    questions: [
      'O produto já foi aprovado ou está em teste?',
      'Qual o tamanho real do mercado endereçável?',
      'O risco de falha clínica está precificado?',
    ],
  },
  {
    slug: 'agro',
    name: 'Agro e commodities agrícolas',
    icon: '🌾',
    description: 'Soja, milho, café, açúcar, clima e ciclo de grãos.',
    keywords: ['agronegócio', 'agronegocio', 'safra', 'soja', 'milho', 'café', 'acucar', 'açúcar', 'algodão', 'algodao', 'seca no campo', 'el niño', 'el nino', 'slc agrícola'],
    assets: ['SLCE3', 'SMTO3', 'B3: agro'],
    questions: [
      'O preço está em ciclo de alta ou de baixa?',
      'O clima (seca/chuva) já está no preço?',
      'A margem do produtor cobre o custo?',
    ],
  },
  {
    slug: 'bancos',
    name: 'Bancos e crédito',
    icon: '🏦',
    description: 'Bancões, inadimplência, spread e crédito privado.',
    keywords: ['itaú', 'bradesco', 'nubank', 'banco do brasil', 'inadimplência', 'inadimplencia', 'spread bancário', 'spread bancario', 'crédito privado', 'credito privado', 'debênture', 'debenture'],
    assets: ['ITUB4', 'BBDC4', 'BBAS3', 'ROXO34'],
    questions: [
      'A inadimplência está subindo ou estabilizando?',
      'O lucro vem de crédito saudável ou de tesouraria?',
      'Juros altos ajudam (spread) ou atrapalham (calote)?',
    ],
  },
  {
    slug: 'fiis',
    name: 'FIIs e mercado imobiliário',
    icon: '🏢',
    description: 'Fundos imobiliários, tijolo vs papel, IFIX e juros.',
    keywords: ['fundo imobiliário', 'fundo imobiliario', 'ifix', 'fii', 'tijolo', 'galpão logístico', 'galpao logistico', 'vacância', 'vacancia'],
    assets: ['HGLG11', 'MXRF11', 'IFIX'],
    questions: [
      'O dividend yield está acima do CDI por risco real ou armadilha?',
      'Vacância e inadimplência dos inquilinos: como estão?',
      'Queda de juros ajuda; alta prolongada pune — onde estamos no ciclo?',
    ],
  },
  {
    slug: 'petroleo-mineracao',
    name: 'Petróleo, gás e mineração',
    icon: '🛢️',
    description: 'Petrobras, pré-sal, minério de ferro, OPEP e dividendos.',
    keywords: ['petrobras', 'petróleo', 'petroleo', 'pré-sal', 'pre-sal', 'minério de ferro', 'minerio de ferro', 'opep', 'barril', 'diesel', 'gasolina', 'política de preços da petrobras'],
    assets: ['PETR4', 'VALE3', 'PRIO3'],
    questions: [
      'O preço da commodity sustenta o dividendo?',
      'Há risco político/estatal na tese (interferência, mudança de regra)?',
      'Ciclo global (China, OPEP) ajuda ou atrapalha?',
    ],
  },
  {
    slug: 'consumo-varejo',
    name: 'Consumo e varejo',
    icon: '🛒',
    description: 'Varejo, e-commerce, shoppings e consumo das famílias.',
    keywords: ['varejo', 'magalu', 'magazine luiza', 'casas bahia', 'consumo das famílias', 'consumo das familias', 'shopping', 'e-commerce', 'ecommerce', 'black friday', 'endividamento das famílias'],
    assets: ['MGLU3', 'BHIA3', 'LREN3'],
    questions: [
      'O consumo está acelerando ou o endividamento trava?',
      'A empresa ganha share ou só acompanha o setor?',
      'Juros e desemprego: vento a favor ou contra?',
    ],
  },
];

export function findOpportunityTheme(slug: string): OpportunityTheme | undefined {
  return OPPORTUNITY_THEMES.find((theme) => theme.slug === slug.toLowerCase());
}
