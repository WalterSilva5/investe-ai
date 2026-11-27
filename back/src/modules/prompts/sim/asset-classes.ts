/**
 * Classificação de ativos em CLASSES (setor/tipo). A hipótese do módulo:
 * prompts que enquadram a leitura no tipo de ativo (banco, commodity, tech…)
 * preveem melhor que um prompt único. O backtest (prompt-sim.service) mede.
 */

export interface AssetClass {
  id: string;
  label: string;
  /** O que tipicamente move esse tipo de ativo (usado nas variantes de prompt). */
  movers: string;
}

export const ASSET_CLASSES: Record<string, AssetClass> = {
  banco: {
    id: 'banco',
    label: 'Banco & finanças',
    movers:
      'bancos dependem do ciclo de crédito e do spread: juro alto sustenta margem mas aumenta inadimplência; ' +
      'resse lendo crédito e crescimento da carteira, não commodities.',
  },
  commodity: {
    id: 'commodity',
    label: 'Commodity & exportadora',
    movers:
      'exportadoras seguem preço da commodity (petróleo, minério, soja) e o câmbio: real desvalorizado aumenta a receita em reais; ' +
      'leia preço da commodity e USD/BRL junto com o gráfico;IGNORE narrativa de consumo interno.',
  },
  tecnologia: {
    id: 'tecnologia',
    label: 'Tecnologia',
    movers:
      'tech responde a crescimento de receita/lucro, despesas de capex e juros longos americanos: juro alto comprime o múltiplo; ' +
      'momentum costuma persistir mais que em outros setores, mas reversão é rápida quando a guia decepciona.',
  },
  consumo: {
    id: 'consumo',
    label: 'Consumo & varejo',
    movers:
      'varejo e consumo seguem massa salarial, crédito e confiança: ciclo doméstico importa mais que câmbio; ' +
      'a competitividade e a margem (guerra de preço) são o risco clássico.',
  },
  industrial: {
    id: 'industrial',
    label: 'Industrial & qualidade',
    movers:
      'industriais de qualidade seguem execução: margem estável, crescimento de receita e gestão de capital; ' +
      'menos sensíveis a câmbio e commodity, mais ao ciclo de investimento interno.',
  },
  juros: {
    id: 'juros',
    label: 'Juros-sensível (FII/utilities)',
    movers:
      'FIIs e utilities são sensíveis a juro: juro alto puxa a cota para baixo (o rendimento precisa compensar); ' +
      'leia o nível do CDI/juro longo como o principal motor, não o humor da bolsa.',
  },
  cripto: {
    id: 'cripto',
    label: 'Cripto',
    movers:
      'cripto é dominada pelo ciclo de liquidez global e pelo ciclo do halving (para BTC/ETH): amplitude muito maior que bolsa; ' +
      'tendências persistem mais, mas drawdowns de 70-80% fazem parte do ciclo.',
  },
  etf: {
    id: 'etf',
    label: 'ETF / índice',
    movers:
      'ETFs seguem o índice: leitura de fluxo e regime de mercado (risk-on/off) vale mais que análise de empresa.',
  },
  industrial_default: {
    id: 'industrial_default',
    label: 'Geral (sem classe específica)',
    movers: 'leia o gráfico e o regime de mercado sem viés de setor.',
  },
};

/** Mapa estático dos tickers conhecidos (o resto cai por heurística). */
const CLASS_BY_SYMBOL: Record<string, string> = {
  // Bancos e financeiras
  ITUB4: 'banco', BBDC4: 'banco', BBAS3: 'banco', BPAC11: 'banco', SANB11: 'banco',
  B3SA3: 'banco', BPAN4: 'banco', BBSE3: 'banco',
  // Commodities e exportadoras
  VALE3: 'commodity', PETR4: 'commodity', PETR3: 'commodity', PRIO3: 'commodity',
  XOM: 'commodity', PBR: 'commodity', CSNA3: 'commodity', GGBR4: 'commodity',
  SUZB3: 'commodity', KLBN4: 'commodity', RAIL3: 'commodity', UGPA3: 'commodity',
  BRFS3: 'commodity', JBSS3: 'commodity', BEEF3: 'commodity',
  // Tecnologia
  AAPL: 'tecnologia', MSFT: 'tecnologia', NVDA: 'tecnologia', AVGO: 'tecnologia',
  TSM: 'tecnologia', META: 'tecnologia', GOOGL: 'tecnologia', AMZN: 'tecnologia',
  TSLA: 'tecnologia', AAPL34: 'tecnologia', MSFT34: 'tecnologia', NVDC34: 'tecnologia',
  // Consumo e varejo
  MGLU3: 'consumo', VVAR3: 'consumo', RENT3: 'consumo', LREN3: 'consumo',
  VIVT3: 'consumo', ABV34: 'consumo',
  // Industriais de qualidade
  WEGE3: 'industrial', EMBR3: 'industrial', MELI: 'industrial',
  // Juros-sensíveis
  MXRF11: 'juros', HGLG11: 'juros', KNCR11: 'juros', XPLG11: 'juros',
  SPTS11: 'juros', TRPL4: 'juros', ELET3: 'juros', ELET6: 'juros',
  // Cripto
  BTC: 'cripto', ETH: 'cripto', SOL: 'cripto',
  // ETFs
  BOVA11: 'etf', IVVB11: 'etf', WRLD11: 'etf', EWZ: 'etf', SPY: 'etf', QQQ: 'etf',
  ABEV3: 'consumo',
};

export function classifySymbol(rawSymbol: string): AssetClass {
  const symbol = String(rawSymbol || '').trim().toUpperCase();
  const mapped = CLASS_BY_SYMBOL[symbol];
  if (mapped && ASSET_CLASSES[mapped]) return ASSET_CLASSES[mapped];
  // Heurísticas: FII termina em 11 (exceto ETFs conhecidos); cripto conhecida; resto cai em geral.
  if (/^[A-Z0-9]{4}11$/.test(symbol)) return ASSET_CLASSES.juros;
  if (['BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE'].includes(symbol)) return ASSET_CLASSES.cripto;
  return ASSET_CLASSES.industrial_default;
}
