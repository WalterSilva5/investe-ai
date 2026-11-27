/**
 * Simulador de passado ("e se eu tivesse investido R$ X há N anos?").
 * Compra no fechamento do primeiro dia, aportes mensais no primeiro pregão
 * de cada mês seguinte, e segura até o fim. Descreve o passado — não prevê.
 */

export interface WhatIfInput {
  points: Array<{ date: string; close: number }>;
  amount: number;
  monthly?: number;
}

export interface YearRow {
  year: number;
  invested: number;
  value: number;
}

export interface WhatIfResult {
  startDate: string;
  endDate: string;
  totalInvested: number;
  finalValue: number;
  profit: number;
  roiPct: number;
  annualizedPct: number;
  maxDrawdownPct: number;
  years: YearRow[];
  contributions: number;
  curve: Array<{ date: string; value: number; invested: number }>;
}

export function whatifRun(input: WhatIfInput): WhatIfResult | null {
  const { points, amount, monthly = 0 } = input;
  if (points.length < 60 || amount <= 0) return null;
  if (monthly < 0) return null;

  let shares = 0;
  let invested = 0;
  const curve: Array<{ date: string; value: number; invested: number }> = [];
  let lastMonth = '';

  for (let i = 0; i < points.length; i += 1) {
    const point = points[i];
    const close = point.close;
    if (close <= 0) return null;
    if (i === 0) {
      shares = amount / close;
      invested = amount;
    } else {
      // Aporte no primeiro pregão de cada mês novo (a partir do 2º mês).
      const month = point.date.slice(0, 7);
      if (monthly > 0 && month !== lastMonth) {
        shares += monthly / close;
        invested += monthly;
      }
      lastMonth = month;
    }
    curve.push({
      date: point.date,
      value: round2(shares * close),
      invested: round2(invested),
    });
  }

  const finalValue = curve[curve.length - 1].value;
  const totalInvested = curve[curve.length - 1].invested;
  const yearsElapsed = curve.length / 252;
  const roi = (finalValue / totalInvested - 1) * 100;
  // Anualizada via IRR (cada aporte descontado no mês em que entrou) — a
  // fórmula simples infla o número quando há aportes mensais.
  const contributions = curve.slice(1).reduce<Array<{ date: string; amount: number }>>(
    (acc, c, i) => {
      const delta = round2(c.invested - curve[i].invested);
      if (delta > 0) acc.push({ date: c.date, amount: delta });
      return acc;
    },
    [{ date: curve[0].date, amount: round2(curve[0].invested) }],
  );
  const irr = irrAnnualPct(contributions, finalValue, curve[curve.length - 1].date);
  const annualized = irr ?? roi / Math.max(1, yearsElapsed);

  // Drawdown sobre o valor de mercado (não sobre o aporte).
  let peak = curve[0].value;
  let maxDrawdown = 0;
  for (const c of curve) {
    if (c.value > peak) peak = c.value;
    if (peak > 0) maxDrawdown = Math.max(maxDrawdown, (peak - c.value) / peak);
  }

  const years = yearBreakdown(curve);

  return {
    startDate: curve[0].date,
    endDate: curve[curve.length - 1].date,
    totalInvested: round2(totalInvested),
    finalValue,
    profit: round2(finalValue - totalInvested),
    roiPct: round2(roi),
    annualizedPct: round2(annualized),
    maxDrawdownPct: round2(maxDrawdown * 100),
    years,
    contributions: Math.round((totalInvested - amount) / monthly) || 0,
    curve,
  };
}

/** Visão por ano: valor investido acumulado e valor de mercado no fim do ano. */
function yearBreakdown(curve: Array<{ date: string; value: number; invested: number }>): YearRow[] {
  const byYear = new Map<number, { value: number; invested: number }>();
  for (const c of curve) {
    const year = Number(c.date.slice(0, 4));
    byYear.set(year, { value: c.value, invested: c.invested });
  }
  return [...byYear.entries()].map(([year, row]) => ({
    year,
    invested: round2(row.invested),
    value: round2(row.value),
  }));
}

/**
 * IRR anualizada (retorno ponderado pelo dinheiro): resolve a taxa que desconta
 * cada aporte no mês em que ele entrou e o valor final no fim. Honesta com
 * aportes mensais — a fórmula simples (final/investido) infla o número.
 */
export function irrAnnualPct(
  contributions: Array<{ date: string; amount: number }>,
  finalValue: number,
  endDate: string,
): number | null {
  if (!contributions.length || finalValue <= 0) return null;
  // Meses absolutos a partir do primeiro aporte.
  const monthDiff = (from: string, to: string): number => {
    const [fy, fm] = from.split('-').map(Number);
    const [ty, tm] = to.split('-').map(Number);
    return (ty - fy) * 12 + (tm - fm);
  };
  const start = contributions.map((c) => c.date).sort()[0];
  const months = contributions.map((c) => ({ t: monthDiff(start, c.date), amount: c.amount }));
  const n = monthDiff(start, endDate);
  if (n < 1 || months.some((m) => m.t < 0)) return null;

  const f = (rate: number): number => {
    let pv = 0;
    for (const c of months) pv -= c.amount / Math.pow(1 + rate, c.t);
    return pv + finalValue / Math.pow(1 + rate, n);
  };
  // Bisseção: f(-0.9) > 0 (investido sem retorno) e f(2) < 0 (retorno absurdo).
  let low = -0.9;
  let high = 2;
  if (f(low) * f(high) > 0) return null;
  for (let i = 0; i < 80; i += 1) {
    const mid = (low + high) / 2;
    if (f(low) * f(mid) <= 0) high = mid;
    else low = mid;
  }
  const rate = (low + high) / 2;
  return round2((Math.pow(1 + rate, 12) - 1) * 100);
}

/**
 * Projeção de cenários para o futuro (12 meses) a partir do PRÓPRIO histórico
 * do papel: retornos anuais realizados, volatilidade anual e frequência
 * histórica de retorno positivo. Cenário estatístico, não promessa — o
 * passado não garante o futuro e a projeção assume que o regime se mantém.
 */
export interface ForwardScenario {
  horizonMonths: number;
  pessimisticPct: number;
  basePct: number;
  optimisticPct: number;
  pessimisticValue: number;
  baseValue: number;
  optimisticValue: number;
  /** % de anos (ou janelas de 12m) com retorno positivo no histórico. */
  probPositive12mPct: number | null;
  yearsSampled: number;
  annualVolPct: number;
}

export function forwardScenario(input: {
  points: Array<{ date: string; close: number }>;
  investedValueNow: number;
  irrPct: number | null;
  horizonMonths?: number;
}): ForwardScenario | null {
  const { points, investedValueNow, irrPct } = input;
  const horizon = Math.max(1, Math.min(60, input.horizonMonths ?? 12));
  if (points.length < 60 || investedValueNow <= 0) return null;

  // Retornos anuais realizados (fechamento do 1º pregão de cada ano).
  const firstByYear = new Map<string, number>();
  for (const p of points) {
    const year = p.date.slice(0, 4);
    if (!firstByYear.has(year)) firstByYear.set(year, p.close);
  }
  const years = [...firstByYear.keys()].sort();
  const yearlyReturns: number[] = [];
  for (let i = 1; i < years.length; i += 1) {
    const prev = firstByYear.get(years[i - 1])!;
    const curr = firstByYear.get(years[i])!;
    if (prev > 0) yearlyReturns.push((curr / prev - 1) * 100);
  }

  // Volatilidade anual do papel (retornos diários).
  const daily: number[] = [];
  for (let i = 1; i < points.length; i += 1) {
    if (points[i - 1].close > 0) daily.push(points[i].close / points[i - 1].close - 1);
  }
  const meanDaily = daily.reduce((a, b) => a + b, 0) / daily.length;
  const varianceDaily =
    daily.reduce((acc, r) => acc + (r - meanDaily) * (r - meanDaily), 0) / (daily.length - 1);
  const annualVol = Math.sqrt(varianceDaily) * Math.sqrt(252) * 100;

  // Probabilidade histórica de retorno positivo em 12m.
  let probPositive: number | null = null;
  if (yearlyReturns.length >= 3) {
    const positives = yearlyReturns.filter((r) => r > 0).length;
    probPositive = Math.round((positives / yearlyReturns.length) * 100);
  } else if (points.length >= 504) {
    // Janela de 12 meses deslizante (degraus mensais).
    let positives = 0;
    let total = 0;
    for (let i = 252; i < points.length; i += 21) {
      total += 1;
      if (points[i].close > points[i - 252].close) positives += 1;
    }
    if (total >= 6) probPositive = Math.round((positives / total) * 100);
  }

  const meanYearly = yearlyReturns.length
    ? yearlyReturns.reduce((a, b) => a + b, 0) / yearlyReturns.length
    : null;
  const sdYearly =
    yearlyReturns.length >= 3
      ? Math.sqrt(
          yearlyReturns.reduce((acc, r) => acc + (r - meanYearly!) ** 2, 0) /
            (yearlyReturns.length - 1),
        )
      : annualVol;
  const horizonYears = horizon / 12;
  const base = irrPct ?? meanYearly ?? 0;
  // Vol escala com √tempo.
  const scaled = (band: number) => {
    const totalPct = band * Math.sqrt(horizonYears) * (1 + horizonYears * 0);
    const value = round2(investedValueNow * (1 + totalPct / 100));
    return { pct: round2(totalPct), value };
  };
  const pessimistic = scaled(base - sdYearly);
  const baseRun = scaled(base);
  const optimistic = scaled(base + sdYearly);

  return {
    horizonMonths: horizon,
    pessimisticPct: pessimistic.pct,
    basePct: baseRun.pct,
    optimisticPct: optimistic.pct,
    pessimisticValue: pessimistic.value,
    baseValue: baseRun.value,
    optimisticValue: optimistic.value,
    probPositive12mPct: probPositive,
    yearsSampled: years.length - 1,
    annualVolPct: round2(annualVol),
  };
}

/**
 * Valor final de uma aplicação em CDI: cada aporte cresce pela taxa diária
 * acumulada do BCB entre a data do aporte e o fim da janela.
 */
export function cdiFinalValue(
  contributions: Array<{ date: string; amount: number }>,
  cdiDaily: Array<{ date: string; pct: number }>,
): { finalValue: number; totalInvested: number } | null {
  if (!cdiDaily.length || !contributions.length) return null;
  // Fator acumulado do fim para trás (evita O(n²)).
  const factors: number[] = new Array(cdiDaily.length).fill(1);
  for (let i = cdiDaily.length - 2; i >= 0; i -= 1) {
    factors[i] = factors[i + 1] * (1 + cdiDaily[i + 1].pct / 100);
  }
  const dateIndex = new Map(cdiDaily.map((d, i) => [d.date, i]));
  let final = 0;
  let invested = 0;
  for (const contribution of contributions) {
    const idx = dateIndex.get(contribution.date);
    if (idx == null) continue;
    final += contribution.amount * factors[idx];
    invested += contribution.amount;
  }
  if (invested === 0) return null;
  return { finalValue: round2(final), totalInvested: round2(invested) };
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
