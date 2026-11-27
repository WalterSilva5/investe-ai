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
  const annualized =
    totalInvested > 0 && finalValue > 0 && yearsElapsed > 0.5
      ? (Math.pow(finalValue / totalInvested, 1 / yearsElapsed) - 1) * 100
      : roi / Math.max(1, yearsElapsed);

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
