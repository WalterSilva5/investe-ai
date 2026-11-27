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
