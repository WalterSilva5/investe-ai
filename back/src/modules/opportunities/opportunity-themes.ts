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
];

export function findOpportunityTheme(slug: string): OpportunityTheme | undefined {
  return OPPORTUNITY_THEMES.find((theme) => theme.slug === slug.toLowerCase());
}
