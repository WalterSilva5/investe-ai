import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MacroService } from './macro.service';
import { QuotesService, CRYPTO_IDS } from './quotes.service';
import { cdiFinalValue, whatifRun, WhatIfResult } from './whatif';

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
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
