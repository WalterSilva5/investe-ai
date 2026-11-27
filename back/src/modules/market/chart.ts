/**
 * Análise de gráfico para o agente (métricas técnicas completas sobre a série
 * de fechamentos): MACD, Bollinger, TODOS os níveis relevantes, estrutura de
 * topos/fundos, cruzamentos de médias e posição vs 52 semanas.
 * Funções puras — testáveis. Descreve o presente e o passado, não prevê.
 */
import { clusterLevels, localMaxs, localMins, rsi } from './indicators';

export function ema(values: number[], period: number): Array<number | null> {
  if (values.length < period) return values.map(() => null);
  const k = 2 / (period + 1);
  const out: Array<number | null> = new Array(period - 1).fill(null);
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out.push(round2(prev));
  for (let i = period; i < values.length; i += 1) {
    prev = values[i] * k + prev * (1 - k);
    out.push(round2(prev));
  }
  return out;
}

export interface Macd {
  macd: number | null;
  signal: number | null;
  histogram: number | null;
  /** 'alta' = MACD cruzou acima da linha de sinal recentemente; 'baixa' = o oposto. */
  crossRecent: 'alta' | 'baixa' | null;
}

export function macd(closes: number[], fast = 12, slow = 26, signalPeriod = 9): Macd {
  if (closes.length < slow + signalPeriod) {
    return { macd: null, signal: null, histogram: null, crossRecent: null };
  }
  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);
  const macdLine = closes.map((_, i) =>
    emaFast[i] != null && emaSlow[i] != null ? round2((emaFast[i] as number) - (emaSlow[i] as number)) : null,
  );
  const macdValues = macdLine.filter((v): v is number => v != null);
  const signalLine = ema(macdValues, signalPeriod);
  const offset = macdLine.length - macdValues.length;
  const last = macdValues[macdValues.length - 1];
  const lastSignal = signalLine[signalLine.length - 1] ?? null;
  const histogram = last != null && lastSignal != null ? round2(last - lastSignal) : null;

  // Cruzamento nos últimos 5 valores.
  let crossRecent: 'alta' | 'baixa' | null = null;
  for (let i = macdValues.length - 1; i >= Math.max(signalPeriod, macdValues.length - 5); i -= 1) {
    const prevMacd = macdValues[i - 1];
    const prevSignal = signalLine[i - 1 - offset];
    const curSignal = signalLine[i - offset];
    if (prevMacd == null || prevSignal == null || curSignal == null) continue;
    if (prevMacd <= prevSignal && macdValues[i] > curSignal) {
      crossRecent = 'alta';
      break;
    }
    if (prevMacd >= prevSignal && macdValues[i] < curSignal) {
      crossRecent = 'baixa';
      break;
    }
  }

  return { macd: last, signal: lastSignal, histogram, crossRecent };
}

export interface Bollinger {
  middle: number | null;
  upper: number | null;
  lower: number | null;
  /** Posição do preço dentro das bandas: 0 = banda inferior, 100 = superior. */
  percentB: number | null;
}

export function bollinger(closes: number[], period = 20, multiplier = 2): Bollinger {
  if (closes.length < period) {
    return { middle: null, upper: null, lower: null, percentB: null };
  }
  const window = closes.slice(-period);
  const middle = window.reduce((a, b) => a + b, 0) / period;
  const variance =
    window.reduce((acc, v) => acc + (v - middle) * (v - middle), 0) / period;
  const sd = Math.sqrt(variance);
  const upper = middle + multiplier * sd;
  const lower = middle - multiplier * sd;
  const last = closes[closes.length - 1];
  const percentB = upper !== lower ? Math.round(((last - lower) / (upper - lower)) * 1000) / 10 : null;
  return {
    middle: round2(middle),
    upper: round2(upper),
    lower: round2(lower),
    percentB,
  };
}

export interface LevelRow {
  price: number;
  distancePct: number;
}

export interface TrendStructure {
  description: string;
  /** topos e fundos crescentes → 'alta'; decrescentes → 'baixa'; misto → 'lateral' */
  pattern: 'alta' | 'baixa' | 'lateral';
}

/** Estrutura de mercado pelos últimos pivôs (topos e fundos). */
export function trendStructure(
  localMaxs: number[],
  localMins: number[],
): TrendStructure | null {
  const highs = localMaxs.slice(-3);
  const lows = localMins.slice(-3);
  if (highs.length < 2 || lows.length < 2) return null;
  const risingHighs = highs.every((h, i) => i === 0 || h > highs[i - 1]);
  const fallingHighs = highs.every((h, i) => i === 0 || h < highs[i - 1]);
  const risingLows = lows.every((l, i) => i === 0 || l > lows[i - 1]);
  const fallingLows = lows.every((l, i) => i === 0 || l < lows[i - 1]);
  let pattern: 'alta' | 'baixa' | 'lateral' = 'lateral';
  if (risingHighs && risingLows) pattern = 'alta';
  else if (fallingHighs && fallingLows) pattern = 'baixa';
  const description =
    pattern === 'alta'
      ? 'topos e fundos crescentes'
      : pattern === 'baixa'
        ? 'topos e fundos decrescentes'
        : 'topos e fundos sem direção clara';
  return { description, pattern };
}

export interface ChartBreakdown {
  price: number;
  ma20: number | null;
  ma50: number | null;
  ma200: number | null;
  goldenDeath: 'dourada (MM50 cruzou acima da MM200)' | 'morte (MM50 cruzou abaixo da MM200)' | null;
  rsi14: number | null;
  macd: Macd;
  bollinger: Bollinger;
  supportsAbove: LevelRow[];
  supportsBelow: LevelRow[];
  resistancesAbove: LevelRow[];
  resistancesBelow: LevelRow[];
  high52w: number | null;
  low52w: number | null;
  fromHigh52wPct: number | null;
  fromLow52wPct: number | null;
  structure: TrendStructure | null;
}

/** Breakdown completo sobre os fechamentos (janela = todo o histórico passado). */
export function chartBreakdown(closes: number[]): ChartBreakdown | null {
  if (closes.length < 60) return null;
  const price = closes[closes.length - 1];
  const pct = (level: number) => round2((level / price - 1) * 100);
  const split = (levels: number[]): Array<LevelRow> =>
    levels.map((level) => ({
      price: round2(level),
      distancePct: pct(level),
    }));

  // TODOS os níveis relevantes da janela (min locais = suportes, max = resistências).
  const windowLevels = closes.slice(-252);
  const allSupports = clusterLevels(localMins(windowLevels), 0.015, 'min');
  const allResistances = clusterLevels(localMaxs(windowLevels), 0.015, 'max');
  const supportsAbove = split(allSupports.filter((level) => level > price));
  const supportsBelow = split(allSupports.filter((level) => level <= price));
  const resistancesAbove = split(allResistances.filter((level) => level > price));
  const resistancesBelow = split(allResistances.filter((level) => level <= price));

  const ma = (period: number): number | null => {
    if (closes.length < period) return null;
    const slice = closes.slice(-period);
    return round2(slice.reduce((a, b) => a + b, 0) / period);
  };
  const ma20 = ma(20);
  const ma50 = ma(50);
  const ma200 = ma(200);

  // Cruzamento MM50 × MM200 nos últimos 10 pregões.
  let goldenDeath: ChartBreakdown['goldenDeath'] = null;
  if (closes.length >= 210) {
    const cross = (lookback: number): number => {
      const slice = closes.slice(-lookback);
      const ma50Then = slice.slice(0, 50).reduce((a, b) => a + b, 0) / 50;
      const ma200Then = slice.slice(0, 200).reduce((a, b) => a + b, 0) / 200;
      return ma50Then > ma200Then ? 1 : -1;
    };
    const now50 = ma50 ?? 0;
    const now200 = ma200 ?? 0;
    if (now50 !== 0 && now200 !== 0) {
      const before = cross(210);
      if (before === -1 && now50 > now200) goldenDeath = 'dourada (MM50 cruzou acima da MM200)';
      if (before === 1 && now50 < now200) goldenDeath = 'morte (MM50 cruzou abaixo da MM200)';
    }
  }

  const window252 = closes.slice(-252);
  const high52 = window252.length ? round2(Math.max(...window252)) : null;
  const low52 = window252.length ? round2(Math.min(...window252)) : null;

  // Estrutura de mercado: pivôs dos últimos ~252 pregões.
  const structure = trendStructure(
    localMaxs(window252).slice(-4),
    localMins(window252).slice(-4),
  );

  return {
    price: round2(price),
    ma20,
    ma50,
    ma200,
    goldenDeath,
    rsi14: rsiAt(closes),
    macd: macd(closes),
    bollinger: bollinger(closes),
    supportsAbove,
    supportsBelow,
    resistancesAbove,
    resistancesBelow,
    high52w: high52,
    low52w: low52,
    fromHigh52wPct: high52 != null ? pct(high52) : null,
    fromLow52wPct: low52 != null ? pct(low52) : null,
    structure,
  };
}

/** RSI do app (Wilder, fonte única em indicators.ts) — evita duas metodologias conflitantes. */
function rsiAt(closes: number[]): number | null {
  return rsi(closes, 14);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
