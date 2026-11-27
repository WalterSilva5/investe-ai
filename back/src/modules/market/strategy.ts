/**
 * Simulador de estratégia: "se eu tivesse seguido o agente, analisando o papel
 * todo mês, comprando em Oportunidade e saindo em Evitar, quanto teria hoje?"
 *
 * Regras (as MESMAS do veredito atual do app — ver indicators.agentSignal):
 * - Analisa no fechamento do último pregão de cada janela mensal (~21 pregões).
 * - Oportunidade → investe TODO o caixa disponível no fechamento do dia.
 * - Evitar com posição → vende tudo no fechamento do dia.
 * - Aguardar → mantém o que tem.
 * - Aporte mensal cai no caixa no primeiro pregão do mês.
 *
 * Retrospectiva. Desempenho passado não garante resultado futuro.
 */
import {
  agentSignal,
  levelsAround,
  setupStats,
  technicalReading,
} from './indicators';

export interface StrategyTrade {
  date: string;
  action: 'COMPRA' | 'VENDA';
  signal: string;
  price: number;
  cashAfter: number;
  sharesAfter: number;
  why: string;
}

export interface AnchorSignalRow {
  date: string;
  signal: 'Oportunidade' | 'Aguardar' | 'Evitar';
  score: number;
  trend: string;
  ratio: number | null;
  price: number;
}

export interface StrategyRunResult {
  startDate: string;
  endDate: string;
  totalInvested: number;
  finalValue: number;
  profit: number;
  roiPct: number;
  irrAnnualPct: number | null;
  maxDrawdownPct: number;
  inMarketAnchors: number;
  anchors: number;
  trades: StrategyTrade[];
  signals: AnchorSignalRow[];
  curve: Array<{ date: string; value: number; invested: number }>;
  buyHold: { invested: number; finalValue: number; profit: number; roiPct: number };
}

export function strategyRun(input: {
  points: Array<{ date: string; close: number }>;
  amount: number;
  monthly?: number;
  step?: number;
  warmup?: number;
  /** Override dos sinais (para testes determinísticos da mecânica). */
  signalOverride?: (anchorIndex: number, price: number) => 'Oportunidade' | 'Aguardar' | 'Evitar' | null;
}): StrategyRunResult | null {
  const { points, amount, monthly = 0 } = input;
  const step = input.step ?? 21;
  const warmup = input.warmup ?? 130;
  if (points.length < warmup + step || amount <= 0) return null;

  let cash = amount;
  let shares = 0;
  let invested = amount;
  let lastMonth = points[0].date.slice(0, 7);
  const trades: StrategyTrade[] = [];
  const signals: AnchorSignalRow[] = [];
  const curve: Array<{ date: string; value: number; invested: number }> = [];
  let inMarketAnchors = 0;
  let anchors = 0;

  const valueAt = (close: number): number => round2(cash + shares * close);

  for (let i = 0; i < points.length; i += 1) {
    const point = points[i];
    const close = point.close;
    if (close <= 0) return null;

    // Aporte mensal cai no caixa no primeiro pregão de cada mês novo.
    const month = point.date.slice(0, 7);
    if (monthly > 0 && month !== lastMonth) {
      cash += monthly;
      invested += monthly;
    }
    lastMonth = month;

    // Análise mensal do agente (no pregão âncora).
    if (i >= warmup && (i - warmup) % step === 0) {
      anchors += 1;
      const window = points.slice(0, i + 1).map((p) => p.close);
      const { supports, resistances } = levelsAround(window);
      const read = technicalReading(window, { supports, resistances });
      const override = input.signalOverride?.(anchors - 1, close) ?? null;
      const signal = override ?? agentSignal(read);
      signals.push({
        date: point.date,
        signal,
        score: read.score,
        trend: read.trend,
        ratio: read.ratio,
        price: round2(close),
      });

      if (signal === 'Oportunidade' && cash >= 10 && shares === 0) {
        shares = cash / close;
        trades.push({
          date: point.date,
          action: 'COMPRA',
          signal,
          price: round2(close),
          cashAfter: 0,
          sharesAfter: Math.round(shares * 10000) / 10000,
          why: `score ${read.score}/100, ganho/risco ${(read.ratio ?? 0).toFixed(2)}:1`,
        });
        cash = 0;
      } else if (signal === 'Evitar' && shares > 0) {
        cash = shares * close;
        trades.push({
          date: point.date,
          action: 'VENDA',
          signal,
          price: round2(close),
          cashAfter: round2(cash),
          sharesAfter: 0,
          why: `score ${read.score}/100${read.trend === 'baixa' ? ', tendência de baixa' : ''}`,
        });
        shares = 0;
      }
      if (shares > 0) inMarketAnchors += 1;
    }

    curve.push({ date: point.date, value: valueAt(close), invested: round2(invested) });
  }

  const finalClose = points[points.length - 1].close;
  const finalValue = round2(cash + shares * finalClose);
  const profit = round2(finalValue - invested);

  // Drawdown da curva de valor de mercado.
  let peak = curve[0].value;
  let maxDrawdown = 0;
  for (const c of curve) {
    if (c.value > peak) peak = c.value;
    if (peak > 0) maxDrawdown = Math.max(maxDrawdown, (peak - c.value) / peak);
  }

  // Compra e segura: mesmo fluxo de caixa, investido desde o dia 1.
  let bhShares = amount / points[0].close;
  let bhInvested = amount;
  let bhLastMonth = points[0].date.slice(0, 7);
  for (let i = 1; i < points.length; i += 1) {
    const month = points[i].date.slice(0, 7);
    if (monthly > 0 && month !== bhLastMonth) {
      bhShares += monthly / points[i].close;
      bhInvested += monthly;
    }
    bhLastMonth = month;
  }
  const bhFinal = round2(bhShares * finalClose);

  return {
    startDate: points[0].date,
    endDate: points[points.length - 1].date,
    totalInvested: round2(invested),
    finalValue,
    profit,
    roiPct: round2((finalValue / invested - 1) * 100),
    irrAnnualPct: null, // preenchido pelo serviço (precisa das datas de aporte)
    maxDrawdownPct: round2(maxDrawdown * 100),
    inMarketAnchors,
    anchors,
    trades,
    signals,
    curve,
    buyHold: {
      invested: round2(bhInvested),
      finalValue: bhFinal,
      profit: round2(bhFinal - bhInvested),
      roiPct: round2((bhFinal / bhInvested - 1) * 100),
    },
  };
}

/** Fluxo de caixa da estratégia (mesmos aportes, independentemente do timing). */
export function strategyContributions(input: {
  points: Array<{ date: string; close: number }>;
  amount: number;
  monthly?: number;
}): Array<{ date: string; amount: number }> {
  const { points, amount, monthly = 0 } = input;
  const out: Array<{ date: string; amount: number }> = [
    { date: points[0].date, amount: amount },
  ];
  let lastMonth = points[0].date.slice(0, 7);
  for (let i = 1; i < points.length; i += 1) {
    const month = points[i].date.slice(0, 7);
    if (monthly > 0 && month !== lastMonth) out.push({ date: points[i].date, amount: monthly });
    lastMonth = month;
  }
  return out;
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
