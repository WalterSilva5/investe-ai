/**
 * Indicadores e leitura de padrões sobre séries de fechamento.
 * Funções puras (sem I/O) para poder testar e para o "Vidente" medir,
 * no histórico do próprio papel, quantas vezes um padrão funcionou.
 * Nada aqui prevê preço: só descreve o passado.
 */

/**
 * Regras de sinal do agente (fonte única — quotes.service.verdictFor e o
 * simulador de estratégia usam a MESMA régua).
 */
export type AgentSignal = 'Oportunidade' | 'Aguardar' | 'Evitar';

export function agentSignal(read: {
  score: number;
  trend: 'alta' | 'baixa' | 'lateral';
  ratio: number | null;
}): AgentSignal {
  const ratio = read.ratio ?? 0;
  if (read.score >= 65 && ratio >= 1.2) return 'Oportunidade';
  if (read.score <= 35 || (read.trend === 'baixa' && ratio < 0.5)) return 'Evitar';
  return 'Aguardar';
}

export function movingAverage(closes: number[], period: number): number | null {
  if (period <= 0 || closes.length < period) return null;
  const slice = closes.slice(-period);
  return round(slice.reduce((a, b) => a + b, 0) / period);
}

/** RSI de Wilder (suavização clássica), último valor da série. */
export function rsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i += 1) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gain += diff;
    else loss -= diff;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  for (let i = period + 1; i < closes.length; i += 1) {
    const diff = closes[i] - closes[i - 1];
    const g = diff > 0 ? diff : 0;
    const l = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return round(100 - 100 / (1 + rs));
}

/** RSI em cada ponto (para achar cruzamentos no histórico). null até ter janela. */
export function rsiSeries(closes: number[], period = 14): Array<number | null> {
  const out: Array<number | null> = new Array(closes.length).fill(null);
  for (let i = period; i < closes.length; i += 1) {
    out[i] = rsi(closes.slice(0, i + 1), period);
  }
  return out;
}

/** Volatilidade anualizada do retorno diário (desvio-padrão × √252). */
export function annualizedVolatility(closes: number[]): number | null {
  if (closes.length < 10) return null;
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i += 1) {
    if (closes[i - 1] > 0) returns.push(closes[i] / closes[i - 1] - 1);
  }
  if (returns.length < 5) return null;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.reduce((acc, r) => acc + (r - mean) * (r - mean), 0) / (returns.length - 1);
  return round(Math.sqrt(variance) * Math.sqrt(252) * 100);
}

/** Variação percentual contra N barras atrás. */
export function changePct(closes: number[], lookback: number): number | null {
  if (lookback <= 0 || closes.length <= lookback) return null;
  const past = closes[closes.length - 1 - lookback];
  const now = closes[closes.length - 1];
  if (!(past > 0)) return null;
  return round(((now - past) / past) * 100);
}

/** Mínimas locais (suportes): ponto menor que a janela dos dois lados. */
export function localMins(closes: number[], window = 5): number[] {
  const found: number[] = [];
  for (let i = window; i < closes.length - window; i += 1) {
    const v = closes[i];
    let isMin = true;
    for (let j = i - window; j <= i + window; j += 1) {
      if (closes[j] < v) {
        isMin = false;
        break;
      }
    }
    if (isMin) found.push(v);
  }
  return found;
}

export function localMaxs(closes: number[], window = 5): number[] {
  const found: number[] = [];
  for (let i = window; i < closes.length - window; i += 1) {
    const v = closes[i];
    let isMax = true;
    for (let j = i - window; j <= i + window; j += 1) {
      if (closes[j] > v) {
        isMax = false;
        break;
      }
    }
    if (isMax) found.push(v);
  }
  return found;
}

/** Agrupa níveis próximos (tolerância relativa) e devolve o extremo do grupo. */
export function clusterLevels(values: number[], tolerance = 0.015, kind: 'min' | 'max' = 'min'): number[] {
  const sorted = [...values].sort((a, b) => (kind === 'min' ? a - b : b - a));
  const groups: number[][] = [];
  for (const v of sorted) {
    const group = groups.find((g) => Math.abs(g[0] - v) / g[0] <= tolerance);
    if (group) group.push(v);
    else groups.push([v]);
  }
  return groups.map((g) => round(kind === 'min' ? Math.min(...g) : Math.max(...g)));
}

/** Níveis do lado certo do preço, mais próximos primeiro. */
export function levelsAround(
  closes: number[],
  window = 5,
  tolerance = 0.015,
  limit = 3,
): { supports: number[]; resistances: number[] } {
  if (closes.length < window * 2 + 3) return { supports: [], resistances: [] };
  const current = closes[closes.length - 1];
  const supports = clusterLevels(localMins(closes, window), tolerance, 'min')
    .filter((v) => v < current)
    .sort((a, b) => Math.abs(a - current) - Math.abs(b - current))
    .slice(0, limit);
  const resistances = clusterLevels(localMaxs(closes, window), tolerance, 'max')
    .filter((v) => v > current)
    .sort((a, b) => Math.abs(a - current) - Math.abs(b - current))
    .slice(0, limit);
  return { supports, resistances };
}

export type SetupKind = 'support' | 'rsi-oversold' | 'ma50-cross';

export interface TechnicalRead {
  trend: 'alta' | 'baixa' | 'lateral';
  score: number;
  label: 'Favorável' | 'Neutro' | 'Desfavorável';
  ma20: number | null;
  ma50: number | null;
  rsi14: number | null;
  dayChange: number | null;
  monthChange: number | null;
  quarterChange: number | null;
  volatility: number | null;
  /** Alvo técnico = resistência mais próxima; stop de referência = suporte mais próximo. */
  target: number | null;
  stop: number | null;
  upsidePct: number | null;
  downsidePct: number | null;
  /** Relação ganho/risco (upside ÷ downside). null quando não há os dois lados. */
  ratio: number | null;
}

/**
 * Leitura técnica resumida e determinística do papel: tendência, força,
 * momentum e relação ganho/risco até os níveis mais próximos.
 * Descreve o estado atual — não projeta preço.
 */
export function technicalReading(
  closes: number[],
  levels: { supports: number[]; resistances: number[] },
): TechnicalRead {
  const current = closes[closes.length - 1];
  const ma20 = movingAverage(closes, 20);
  const ma50 = movingAverage(closes, 50);
  const rsi14 = rsi(closes, 14);
  const dayChange = changePct(closes, 1);
  const monthChange = changePct(closes, 21);
  const quarterChange = changePct(closes, 63);
  const volatility = annualizedVolatility(closes);

  let trend: TechnicalRead['trend'] = 'lateral';
  if (ma20 != null && ma50 != null) {
    if (current > ma20 && ma20 > ma50) trend = 'alta';
    else if (current < ma20 && ma20 < ma50) trend = 'baixa';
  }

  let score = 50;
  if (ma50 != null) score += current > ma50 ? 12 : -12;
  if (ma20 != null && ma50 != null) score += ma20 > ma50 ? 10 : -10;
  if (rsi14 != null) {
    if (rsi14 > 75) score -= 8;
    else if (rsi14 < 30) score -= 4;
    else if (rsi14 >= 45 && rsi14 <= 65) score += 6;
    else if (rsi14 > 30 && rsi14 < 45) score += 4;
  }
  if (monthChange != null) score += monthChange > 0 ? 8 : -8;
  if (quarterChange != null) score += quarterChange > 0 ? 6 : -6;
  score = Math.min(100, Math.max(0, Math.round(score)));
  const label: TechnicalRead['label'] = score >= 65 ? 'Favorável' : score >= 45 ? 'Neutro' : 'Desfavorável';

  const target = levels.resistances[0] ?? null;
  const stop = levels.supports[0] ?? null;
  const upsidePct =
    target != null && current > 0 ? round(((target - current) / current) * 100) : null;
  const downsidePct =
    stop != null && current > 0 ? round(((current - stop) / current) * 100) : null;
  const ratio =
    upsidePct != null && downsidePct != null && downsidePct > 0
      ? round(upsidePct / downsidePct)
      : null;

  return {
    trend,
    score,
    label,
    ma20,
    ma50,
    rsi14,
    dayChange,
    monthChange,
    quarterChange,
    volatility,
    target,
    stop,
    upsidePct,
    downsidePct,
    ratio,
  };
}

export interface SetupOccurrence {
  index: number;
  price: number;
  /** Retorno % após o horizonte; null quando ainda não há barras futuras. */
  forward: number | null;
}

export interface SetupStats {
  setup: SetupKind;
  horizon: number;
  occurrences: number;
  completed: number;
  winRate: number | null;
  avgReturn: number | null;
  medianReturn: number | null;
  best: number | null;
  worst: number | null;
}

/**
 * Encontra ocorrências históricas de um padrão:
 * - support: fecha a até 2% acima da mínima das últimas 20 barras (teste de suporte);
 * - rsi-oversold: RSI(14) cruza para <= 35;
 * - ma50-cross: fecha cruza para cima da MM50.
 * Sem lookahead: usa apenas barras até cada índice.
 */
export function findSetupOccurrences(closes: number[], setup: SetupKind): SetupOccurrence[] {
  const out: SetupOccurrence[] = [];
  if (closes.length < 30) return out;
  const rsiSeq = setup === 'rsi-oversold' ? rsiSeries(closes, 14) : [];
  for (let i = 25; i < closes.length - 1; i += 1) {
    const price = closes[i];
    if (!(price > 0)) continue;
    if (setup === 'support') {
      const window = closes.slice(Math.max(0, i - 20), i);
      if (!window.length) continue;
      const support = Math.min(...window);
      if (price >= support && (price - support) / price <= 0.02) {
        out.push({ index: i, price, forward: null });
      }
      continue;
    }
    if (setup === 'rsi-oversold') {
      const now = rsiSeq[i];
      const prev = rsiSeq[i - 1];
      if (now != null && prev != null && now <= 35 && prev > 35) {
        out.push({ index: i, price, forward: null });
      }
      continue;
    }
    const maNow = movingAverage(closes.slice(0, i + 1), 50);
    const maPrev = movingAverage(closes.slice(0, i), 50);
    if (maNow != null && maPrev != null && closes[i] > maNow && closes[i - 1] <= maPrev) {
      out.push({ index: i, price, forward: null });
    }
  }
  return out;
}

/** Preenche o retorno futuro de cada ocorrência para o horizonte pedido. */
export function withForwardReturns(
  closes: number[],
  occurrences: SetupOccurrence[],
  horizon: number,
): SetupOccurrence[] {
  return occurrences.map((occ) => {
    const future = closes[occ.index + horizon];
    const forward =
      future && occ.price > 0 ? round(((future - occ.price) / occ.price) * 100) : null;
    return { ...occ, forward };
  });
}

export function setupStats(
  closes: number[],
  setup: SetupKind,
  horizon: number,
): SetupStats {
  const occurrences = withForwardReturns(closes, findSetupOccurrences(closes, setup), horizon);
  const done = occurrences.filter((o) => o.forward != null) as Array<
    SetupOccurrence & { forward: number }
  >;
  const returns = done.map((o) => o.forward).sort((a, b) => a - b);
  const wins = returns.filter((r) => r > 0).length;
  const median =
    returns.length === 0
      ? null
      : returns.length % 2 === 1
        ? returns[(returns.length - 1) / 2]
        : round((returns[returns.length / 2 - 1] + returns[returns.length / 2]) / 2);
  return {
    setup,
    horizon,
    occurrences: occurrences.length,
    completed: done.length,
    winRate: done.length ? round((wins / done.length) * 100) : null,
    avgReturn: returns.length ? round(returns.reduce((a, b) => a + b, 0) / returns.length) : null,
    medianReturn: median,
    best: returns.length ? returns[returns.length - 1] : null,
    worst: returns.length ? returns[0] : null,
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
