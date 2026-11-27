import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MacroService } from './macro.service';
import { QuotesService, CRYPTO_IDS } from './quotes.service';
import {
  cdiFinalValue,
  irrAnnualPct,
  whatifRun,
  WhatIfResult,
} from './whatif';
import { strategyContributions, strategyRun } from './strategy';

/**
 * Simulador de passado: "se eu tivesse investido R$ X há N anos, quanto
 * teria hoje?" — compra no primeiro pregão, aportes mensais opcionais no
 * primeiro pregão de cada mês, e compara com o CDI do mesmo período.
 * Retrospectiva: não prevê nada e não garante repetição do padrão.
 */
@Injectable()
export class WhatIfService {
  constructor(
    private readonly quotes: QuotesService,
    private readonly macro: MacroService,
  ) {}

  async run(symbol: string, amount: number, months: number, monthly: number) {
    const clean = String(symbol || '').trim().toUpperCase();
    if (!clean) throw new BadRequestException('Informe o símbolo.');
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Valor inicial precisa ser positivo.');
    }
    if (!Number.isFinite(monthly) || monthly < 0) {
      throw new BadRequestException('Aporte mensal inválido.');
    }
    const monthsClamped = Math.max(3, Math.min(60, Math.round(months || 12)));
    // Cripto: CoinGecko só expõe ~1 ano de histórico sem chave paga.
    const monthsEffective = CRYPTO_IDS[clean] ? Math.min(monthsClamped, 12) : monthsClamped;
    const range = monthsEffective <= 12 ? '1y' : monthsEffective <= 24 ? '2y' : '5y';

    const { symbol: resolved, currency, points } = await this.quotes.history(clean, range);
    if (points.length < 60) {
      throw new NotFoundException(`Histórico insuficiente para ${resolved}.`);
    }
    const result = whatifRun({ points, amount, monthly });
    if (!result) {
      throw new NotFoundException('Histórico insuficiente para a simulação.');
    }

    // Aportes efetuados (onde o total investido subiu) para comparar com CDI.
    const contributions: Array<{ date: string; amount: number }> = [];
    let previousInvested = 0;
    for (const c of result.curve) {
      if (c.invested > previousInvested) {
        contributions.push({ date: c.date, amount: round2(c.invested - previousInvested) });
      }
      previousInvested = c.invested;
    }

    let cdi: { totalInvested: number; finalValue: number } | null = null;
    if (currency === 'BRL') {
      try {
        const start = new Date(result.startDate);
        const end = new Date(result.endDate);
        const cdiDaily = await this.macro.cdiSeriesDaily(start, end);
        cdi = cdiFinalValue(contributions, cdiDaily);
      } catch {
        cdi = null; // BCB indisponível: comparativo fica sem valor (UI lida com null)
      }
    }

    return {
      symbol: resolved,
      currency,
      amount,
      monthly,
      months: monthsEffective,
      ...result,
      cdi,
      note:
        'Retrospectiva com dados históricos: compra no primeiro pregão e aportes mensais no primeiro pregão de cada mês. O padrão passado não garante resultado futuro.',
    };
  }

  /** Aportes efetuados (onde o total investido subiu) — usado no comparativo CDI. */
  private contributionsFromCurve(result: WhatIfResult) {    const contributions: Array<{ date: string; amount: number }> = [];
    let previousInvested = 0;
    for (const c of result.curve) {
      if (c.invested > previousInvested) {
        contributions.push({ date: c.date, amount: round2(c.invested - previousInvested) });
      }
      previousInvested = c.invested;
    }
    return contributions;
  }

  /**
   * Simulação DIVERSIFICADA: várias pernas (símbolo, valor, aporte mensal) e o
   * total combinado. Cada perna é simulada com a mesma lógica do whatifRun;
   * o total soma os valores de mercado por data em comum entre os ativos.
   */
  async portfolio(
    legs: Array<{ symbol: string; amount: number; monthly?: number }>,
    months: number,
  ) {
    if (!Array.isArray(legs) || legs.length < 1) {
      throw new BadRequestException('Informe ao menos uma perna { symbol, amount }.');
    }
    const clean = legs.slice(0, 8).map((leg) => ({
      symbol: String(leg?.symbol || '').trim().toUpperCase(),
      amount: Number(leg?.amount) || 0,
      monthly: Math.max(0, Number(leg?.monthly) || 0),
    }));
    if (clean.some((leg) => !leg.symbol || leg.amount <= 0)) {
      throw new BadRequestException('Cada perna precisa de symbol e amount > 0.');
    }
    const monthsClamped = Math.max(3, Math.min(60, Math.round(months || 12)));

    interface Leg {
      symbol: string;
      currency: string;
      amount: number;
      monthly: number;
      invested: number;
      finalValue: number;
      profit: number;
      roiPct: number;
      valueByDate: Map<string, number>;
      contributions: Array<{ date: string; amount: number }>;
      cdiFinal: number | null;
    }
    const legResults: Leg[] = [];

    for (const leg of clean) {
      // Cripto: CoinGecko só expõe ~1 ano sem chave paga.
      const monthsEffective = CRYPTO_IDS[leg.symbol] ? Math.min(monthsClamped, 12) : monthsClamped;
      const range = monthsEffective <= 12 ? '1y' : monthsEffective <= 24 ? '2y' : '5y';
      let history: { symbol: string; currency: string; points: Array<{ date: string; close: number }> };
      try {
        history = await this.quotes.history(leg.symbol, range);
      } catch (error) {
        throw new NotFoundException(`${leg.symbol}: ${(error as Error).message.slice(0, 90)}`);
      }
      const result = whatifRun({
        points: history.points,
        amount: leg.amount,
        monthly: leg.monthly,
      });
      if (!result) {
        throw new NotFoundException(`${leg.symbol}: histórico insuficiente.`);
      }
      let cdiFinal: number | null = null;
      const contributions = this.contributionsFromCurve(result);
      if (history.currency === 'BRL') {
        try {
          const cdiDaily = await this.macro.cdiSeriesDaily(
            new Date(result.startDate),
            new Date(result.endDate),
          );
          const cdi = cdiFinalValue(contributions, cdiDaily);
          cdiFinal = cdi?.finalValue ?? null;
        } catch {
          cdiFinal = null;
        }
      }
      legResults.push({
        symbol: history.symbol,
        currency: history.currency,
        amount: leg.amount,
        monthly: leg.monthly,
        invested: result.totalInvested,
        finalValue: result.finalValue,
        profit: result.profit,
        roiPct: result.roiPct,
        valueByDate: new Map(result.curve.map((c) => [c.date, c.value])),
        contributions,
        cdiFinal,
      });
    }

    // Total combinado: soma dos valores por data presente em TODAS as pernas.
    const combinedDates: string[] = [];
    for (const date of legResults[0].valueByDate.keys()) {
      if (legResults.every((leg) => leg.valueByDate.has(date))) combinedDates.push(date);
    }
    if (combinedDates.length < 60) {
      throw new BadRequestException(
        'Janela em comum entre os ativos pequena demais (cripto limita a 1 ano). Reduza a janela ou troque o ativo.',
      );
    }
    const combinedValues = combinedDates.map((date) =>
      round2(legResults.reduce((acc, leg) => acc + (leg.valueByDate.get(date) || 0), 0)),
    );
    const totalInvested = round2(legResults.reduce((acc, leg) => acc + leg.invested, 0));
    const totalFinal = round2(legResults.reduce((acc, leg) => acc + leg.finalValue, 0));
    // Anualizada via IRR do fluxo combinado (aportes de todas as pernas por data).
    const combinedContributions = new Map<string, number>();
    for (const leg of legResults) {
      for (const c of leg.contributions) {
        combinedContributions.set(c.date, round2((combinedContributions.get(c.date) || 0) + c.amount));
      }
    }
    const irr = irrAnnualPct(
      [...combinedContributions.entries()].map(([date, amount]) => ({ date, amount })),
      totalFinal,
      combinedDates[combinedDates.length - 1],
    );
    const yearsElapsed = combinedDates.length / 252;
    const annualized =
      irr ?? round2(((totalFinal / totalInvested - 1) * 100) / Math.max(1, yearsElapsed));
    let peak = combinedValues[0];
    let maxDrawdown = 0;
    for (const value of combinedValues) {
      if (value > peak) peak = value;
      if (peak > 0) maxDrawdown = Math.max(maxDrawdown, (peak - value) / peak);
    }

    const allBrl = legResults.every((leg) => leg.currency === 'BRL');
    const cdiFinalTotal = allBrl
      ? round2(legResults.reduce((acc, leg) => acc + (leg.cdiFinal || 0), 0))
      : null;

    return {
      legs: legResults.map((leg) => ({
        symbol: leg.symbol,
        currency: leg.currency,
        amount: leg.amount,
        monthly: leg.monthly,
        invested: leg.invested,
        finalValue: leg.finalValue,
        profit: leg.profit,
        roiPct: leg.roiPct,
      })),
      months: monthsClamped,
      window: { start: combinedDates[0], end: combinedDates[combinedDates.length - 1] },
      total: {
        invested: totalInvested,
        finalValue: totalFinal,
        profit: round2(totalFinal - totalInvested),
        roiPct: round2((totalFinal / totalInvested - 1) * 100),
        annualizedPct: round2(annualized),
        maxDrawdownPct: round2(maxDrawdown * 100),
      },
      cdi: cdiFinalTotal != null ? { invested: totalInvested, finalValue: cdiFinalTotal } : null,
      note:
        'Retrospectiva por perna (compra no primeiro pregão, aportes mensais) somada por data em comum. O padrão passado não garante resultado futuro.',
    };
  }

  /**
   * "E se eu tivesse SEGUIDO O AGENTE?": análises mensais no período, comprando
   * em Oportunidade e saindo em Evitar (mesma régua do veredito atual).
   * Compara com compra-e-segura e com o CDI no mesmo fluxo de caixa.
   */
  async strategy(symbol: string, amount: number, months: number, monthly: number) {
    const clean = String(symbol || '').trim().toUpperCase();
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Valor inicial precisa ser positivo.');
    }
    const monthsClamped = Math.max(12, Math.min(60, Math.round(months || 24)));
    const monthsEffective = CRYPTO_IDS[clean] ? Math.min(monthsClamped, 12) : monthsClamped;
    const range = monthsEffective <= 12 ? '1y' : monthsEffective <= 24 ? '2y' : '5y';

    const { symbol: resolved, currency, points } = await this.quotes.history(clean, range);
    if (points.length < 180) {
      throw new NotFoundException(`Histórico insuficiente para ${resolved} (precisa de ~12 meses).`);
    }
    const result = strategyRun({ points, amount, monthly });
    if (!result) {
      throw new NotFoundException('Histórico insuficiente para a simulação de estratégia.');
    }
    // IRR sobre o fluxo de caixa da estratégia (mesmos aportes, mesmo fim).
    const contributions = strategyContributions({ points, amount, monthly });
    const irr = irrAnnualPct(contributions, result.finalValue, result.endDate);
    result.irrAnnualPct = irr;

    // CDI no MESMO fluxo de caixa (só BRL).
    let cdi: { invested: number; finalValue: number } | null = null;
    if (currency === 'BRL') {
      try {
        const cdiDaily = await this.macro.cdiSeriesDaily(
          new Date(result.startDate),
          new Date(result.endDate),
        );
        const cdiRun = cdiFinalValue(contributions, cdiDaily);
        cdi = cdiRun ? { invested: cdiRun.totalInvested, finalValue: cdiRun.finalValue } : null;
      } catch {
        cdi = null;
      }
    }

    return {
      symbol: resolved,
      currency,
      amount,
      monthly,
      months: monthsEffective,
      agent: {
        invested: result.totalInvested,
        finalValue: result.finalValue,
        profit: result.profit,
        roiPct: result.roiPct,
        irrAnnualPct: result.irrAnnualPct,
        maxDrawdownPct: result.maxDrawdownPct,
        anchors: result.anchors,
        inMarketAnchors: result.inMarketAnchors,
      },
      buyHold: result.buyHold,
      cdi,
      signals: result.signals,
      trades: result.trades,
      curve: result.curve,
      note:
        'Retrospectiva: análises mensais com a MESMA régua do veredito atual (Oportunidade = score ≥ 65 e ganho/risco ≥ 1,2; Evitar = score ≤ 35 ou baixa sem relação). Oportunidade investe o caixa inteiro; Evitar zera a posição. Desempenho passado não garante resultado futuro.',
    };
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
