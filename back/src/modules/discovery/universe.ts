/**
 * Universo varrido pela descoberta. Lista curada (liquidez e relevância),
 * não recomendação: o scan só mede o estado técnico de cada papel.
 */
export const DISCOVERY_UNIVERSE: Array<{ symbol: string; type: 'B3' | 'US' | 'CRYPTO' }> = [
  // B3 — blue chips e nomes líquidos
  { symbol: 'PETR4', type: 'B3' },
  { symbol: 'VALE3', type: 'B3' },
  { symbol: 'ITUB4', type: 'B3' },
  { symbol: 'BBDC4', type: 'B3' },
  { symbol: 'BBAS3', type: 'B3' },
  { symbol: 'ABEV3', type: 'B3' },
  { symbol: 'WEGE3', type: 'B3' },
  { symbol: 'RENT3', type: 'B3' },
  { symbol: 'SUZB3', type: 'B3' },
  { symbol: 'ELET3', type: 'B3' },
  { symbol: 'PRIO3', type: 'B3' },
  { symbol: 'RAIL3', type: 'B3' },
  { symbol: 'LREN3', type: 'B3' },
  { symbol: 'MGLU3', type: 'B3' },
  { symbol: 'BPAC11', type: 'B3' },
  { symbol: 'HGLG11', type: 'B3' },
  { symbol: 'MXRF11', type: 'B3' },
  // EUA — grandes nomes
  { symbol: 'AAPL', type: 'US' },
  { symbol: 'MSFT', type: 'US' },
  { symbol: 'NVDA', type: 'US' },
  { symbol: 'GOOGL', type: 'US' },
  { symbol: 'AMZN', type: 'US' },
  { symbol: 'META', type: 'US' },
  { symbol: 'TSLA', type: 'US' },
  { symbol: 'AVGO', type: 'US' },
  { symbol: 'JPM', type: 'US' },
  { symbol: 'XOM', type: 'US' },
  // Cripto (CoinGecko)
  { symbol: 'BTC', type: 'CRYPTO' },
  { symbol: 'ETH', type: 'CRYPTO' },
];
