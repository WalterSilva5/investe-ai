/**
 * Matemática pura para as tools do agente: alinhamento de séries,
 * correlação de Pearson e backtest de carteira com pesos fixos.
 * Sem I/O — testável e reutilizável. Nada aqui prevê preço: descreve o passado.
 */

export interface Points {
  date: string;
  close: number;
}

export interface AlignedSeries {
  dates: string[];
  /** closes[i] = fechamentos alinhados na data dates[i], na ordem de symbols. */
  closes: number[][];
}

/** Interseção de datas entre as séries (mantém a ordem cronológica). */
export function alignSeries(series: Array<{ symbol: string; points: Points[] }>): AlignedSeries {
  if (!series.length) return { dates: [], closes: [] };
  const maps = series.map((s) => new Map(s.points.map((p) => [p.date, p.close])));
  const dates = [...maps[0].keys()]
    .filter((date) => maps.every((m) => m.has(date)))
    .sort();
  return {
    dates,
    closes: dates.map((date) => maps.map((m) => m.get(date) as number)),
  };
}

/** Retorna semanal (amostra cada ~5 pontos) para correlação estável. */
export function weeklySample(aligned: AlignedSeries): AlignedSeries {
  const step = 5;
  const idx: number[] = [];
  for (let i = aligned.dates.length - 1; i >= 0; i -= step) idx.push(i);
  idx.reverse();
  return {
    dates: idx.map((i) => aligned.dates[i]),
    closes: idx.map((i) => aligned.closes[i]),
  };
}

/** Retornos simples entre pontos consecutivos. */
export function returns(values: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < values.length; i += 1) {
    if (values[i - 1] > 0) out.push(values[i] / values[i - 1] - 1);
  }
  return out;
}

/** Correlação de Pearson (-1 a 1); null quando insuficiente/degenerado. */
export function pearson(a: number[], b: number[]): number | null {
  const n = Math.min(a.length, b.length);
  if (n < 8) return null;
  const ra = returns(a.slice(0, n + 1));
  const rb = returns(b.slice(0, n + 1));
  const m = Math.min(ra.length, rb.length);
  if (m < 8) return null;
  const mean = (xs: number[]) => xs.reduce((acc, x) => acc + x, 0) / m;
  const ma = mean(ra.slice(0, m));
  const mb = mean(rb.slice(0, m));
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < m; i += 1) {
    const x = ra[i] - ma;
    const y = rb[i] - mb;
    num += x * y;
    da += x * x;
    db += y * y;
  }
  if (da === 0 || db === 0) return null;
  return num / Math.sqrt(da * db);
}

export interface CorrelationPair {
  a: string;
  b: string;
  r: number | null;
}

/** Matriz de pares (sem diagonal) sobre fechamentos alinhados. */
export function correlationPairs(
  symbols: string[],
  aligned: AlignedSeries,
): CorrelationPair[] {
  // closes é matriz linhas=datas × colunas=símbolos: a série de um símbolo é a COLUNA.
  const col = (i: number): number[] => aligned.closes.map((row) => row[i]);
  const out: CorrelationPair[] = [];
  for (let i = 0; i < symbols.length; i += 1) {
    for (let j = i + 1; j < symbols.length; j += 1) {
      const r = pearson(col(i), col(j));
      out.push({
        a: symbols[i],
        b: symbols[j],
        r: r == null ? null : Math.round(r * 100) / 100,
      });
    }
  }
  return out;
}

export interface PortfolioMetrics {
  totalReturnPct: number;
  annualizedPct: number;
  volAnnualPct: number;
  maxDrawdownPct: number;
  bestMonthPct: number;
  worstMonthPct: number;
  periods: number;
}

/**
 * Backtest buy&hold com rebalanceamento a cada passo (soma dos pesos das
 * curvas normalizadas). Pesos precisam somar ~1.
 */
export function portfolioBacktest(
  weights: number[],
  aligned: AlignedSeries,
): PortfolioMetrics | null {
  const n = aligned.dates.length;
  if (n < 21 || weights.length !== aligned.closes[0].length) return null;
  if (weights.some((w) => w < 0) || Math.abs(weights.reduce((a, b) => a + b, 0) - 1) > 0.02) {
    return null;
  }
  const curve: number[] = [];
  for (let t = 0; t < n; t += 1) {
    let value = 0;
    for (let i = 0; i < weights.length; i += 1) {
      const base = aligned.closes[0][i];
      if (base <= 0) return null;
      value += weights[i] * (aligned.closes[t][i] / base);
    }
    curve.push(value);
  }
  const total = (curve[n - 1] - 1) * 100;
  const daily = returns(curve);
  const mean = daily.reduce((a, b) => a + b, 0) / daily.length;
  const variance =
    daily.reduce((acc, r) => acc + (r - mean) * (r - mean), 0) / (daily.length - 1);
  const vol = Math.sqrt(variance) * Math.sqrt(252) * 100;
  const periodsPerYear = daily.length / (n / 252);
  const annualized = (Math.pow(1 + mean, periodsPerYear) - 1) * 100;

  let peak = curve[0];
  let maxDrawdown = 0;
  for (const value of curve) {
    if (value > peak) peak = value;
    const dd = (peak - value) / peak;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  // Melhor/pior mês (~21 dias).
  const monthReturns: number[] = [];
  for (let i = 21; i < n; i += 21) {
    monthReturns.push((curve[i] / curve[i - 21] - 1) * 100);
  }
  const best = monthReturns.length ? Math.max(...monthReturns) : 0;
  const worst = monthReturns.length ? Math.min(...monthReturns) : 0;

  return {
    totalReturnPct: round2(total),
    annualizedPct: round2(annualized),
    volAnnualPct: round2(vol),
    maxDrawdownPct: round2(maxDrawdown * 100),
    bestMonthPct: round2(best),
    worstMonthPct: round2(worst),
    periods: n,
  };
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
