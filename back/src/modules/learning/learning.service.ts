import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { QuotesService } from '../market/quotes.service';

/** Regras que geram sinal de direção (as demais não viram log). */
export type SignalRule = 'trend-up' | 'trend-down' | 'rsi-oversold';

const RULE_LABELS: Record<string, string> = {
  'trend-up': 'Tendência de alta (MM20 > MM50)',
  'trend-down': 'Tendência de baixa (MM20 < MM50)',
  'rsi-oversold': 'RSI em sobrevenda (≤ 35)',
};

/** Dias corridos até a avaliação do sinal (≈ 2 semanas de pregões). */
const EVAL_DAYS = 14;
/** Mínimo de avaliações para a calibração valer (evita overfit em 2 casos). */
const MIN_SAMPLES = 6;

@Injectable()
export class LearningService {
  private readonly logger = new Logger(LearningService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly quotes: QuotesService,
  ) {}

  /**
   * Outlook com aprendizado: calcula a leitura base, aplica a calibração das
   * regras já avaliadas e registra o sinal do dia (dedupe por dia/regra).
   */
  async outlook(tenantId: string, symbol: string, range = '1y') {
    const base = await this.quotes.outlook(symbol, range);
    const rule = this.ruleFor(base);
    const direction = this.directionFor(rule);
    const calibration = rule
      ? await this.calibration(tenantId, rule)
      : { rule: null, committed: 0, hitRate: null, adjustment: 0, learned: false };

    const rawScore = base.read.score;
    const score = Math.min(100, Math.max(0, rawScore + calibration.adjustment));
    const label = score >= 65 ? 'Favorável' : score >= 45 ? 'Neutro' : 'Desfavorável';

    if (rule && direction) {
      await this.recordSignal(tenantId, {
        symbol: base.symbol,
        rule,
        direction,
        score,
        price: base.current,
        target: base.read.target,
        stop: base.read.stop,
      });
    }

    return {
      ...base,
      read: { ...base.read, score, label, rawScore },
      calibration: {
        ...calibration,
        rule,
        ruleLabel: rule ? RULE_LABELS[rule] : null,
        direction,
      },
    };
  }

  private ruleFor(base: { read: { rsi14: number | null; trend: string } }): SignalRule | null {
    if (base.read.rsi14 != null && base.read.rsi14 <= 35) return 'rsi-oversold';
    if (base.read.trend === 'alta') return 'trend-up';
    if (base.read.trend === 'baixa') return 'trend-down';
    return null;
  }

  private directionFor(rule: SignalRule | null): 'up' | 'down' | null {
    if (rule === 'trend-down') return 'down';
    if (rule) return 'up';
    return null;
  }

  /** Grava o sinal do dia (idempotente: 1 por símbolo+regra+dia). */
  async recordSignal(
    tenantId: string,
    signal: {
      symbol: string;
      rule: string;
      direction: 'up' | 'down';
      score: number;
      price: number;
      target?: number | null;
      stop?: number | null;
      kind?: string;
    },
  ) {
    const day = new Date().toISOString().slice(0, 10);
    await this.prisma.signalLog.upsert({
      where: {
        tenantId_symbol_rule_day: {
          tenantId,
          symbol: signal.symbol,
          rule: signal.rule,
          day,
        },
      },
      create: {
        tenantId,
        symbol: signal.symbol,
        rule: signal.rule,
        direction: signal.direction,
        score: signal.score,
        price: signal.price,
        target: signal.target ?? null,
        stop: signal.stop ?? null,
        day,
        kind: signal.kind || 'outlook',
      },
      update: {
        score: signal.score,
        price: signal.price,
        target: signal.target ?? null,
        stop: signal.stop ?? null,
      },
    });
  }

  /**
   * Avalia sinais pendentes com pelo menos 14 dias: pega o fechamento na data
   * alvo e marca acerto/erro conforme a direção sinalizada.
   */
  async evaluatePending(tenantId: string) {
    const limit = new Date(Date.now() - EVAL_DAYS * 86_400_000).toISOString().slice(0, 10);
    const pending = await this.prisma.signalLog.findMany({
      where: { tenantId, outcome: 'pending', day: { lte: limit } },
      orderBy: { day: 'asc' },
      take: 200,
    });
    if (!pending.length) return { evaluated: 0, stillPending: 0 };

    const bySymbol = new Map<string, typeof pending>();
    for (const signal of pending) {
      const list = bySymbol.get(signal.symbol) || [];
      list.push(signal);
      bySymbol.set(signal.symbol, list);
    }

    let evaluated = 0;
    for (const [symbol, signals] of bySymbol) {
      let points: Array<{ date: string; close: number }>;
      try {
        ({ points } = await this.quotes.history(symbol, '3mo'));
      } catch {
        continue; // sem histórico agora: tenta na próxima rodada
      }
      for (const signal of signals) {
        const targetDate = this.addDays(signal.day, EVAL_DAYS);
        const point = points.find((p) => p.date >= targetDate);
        if (!point || !(signal.price > 0)) continue;
        const returnPct = Math.round(((point.close - signal.price) / signal.price) * 10000) / 100;
        const hit = signal.direction === 'up' ? returnPct > 0 : returnPct < 0;
        await this.prisma.signalLog.update({
          where: { id: signal.id },
          data: {
            evaluatedAt: new Date(),
            outcome: hit ? 'hit' : 'miss',
            returnPct,
            priceAfter: point.close,
          },
        });
        evaluated += 1;
      }
    }
    this.logger.log(`Sinais avaliados (${tenantId}): ${evaluated}/${pending.length}.`);
    return { evaluated, stillPending: pending.length - evaluated };
  }

  private addDays(day: string, days: number): string {
    const date = new Date(`${day}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }

  /** Calibração da regra: acerto histórico (suavizado) e ajuste do score. */
  async calibration(tenantId: string, rule: string) {
    const rows = await this.prisma.signalLog.findMany({
      where: { tenantId, rule, outcome: { in: ['hit', 'miss'] } },
      select: { outcome: true },
    });
    const committed = rows.length;
    const hits = rows.filter((r) => r.outcome === 'hit').length;
    const hitRate = committed ? Math.round((hits / committed) * 10000) / 100 : null;
    // Laplace: evita 100% com 2 casos; só ajusta com massa mínima.
    const smoothed = (hits + 1) / (committed + 2);
    const adjustment = committed >= MIN_SAMPLES ? Math.round((smoothed - 0.5) * 20) : 0;
    return {
      rule,
      committed,
      hits,
      hitRate,
      adjustment,
      learned: committed >= MIN_SAMPLES,
    };
  }

  /** Resumo do aprendizado: desempenho por regra e direção. */
  async summary(tenantId: string) {
    const [total, pending, rows] = await Promise.all([
      this.prisma.signalLog.count({ where: { tenantId } }),
      this.prisma.signalLog.count({ where: { tenantId, outcome: 'pending' } }),
      this.prisma.signalLog.findMany({
        where: { tenantId, outcome: { in: ['hit', 'miss'] } },
        select: { rule: true, direction: true, outcome: true, returnPct: true },
      }),
    ]);

    const acc = new Map<
      string,
      { rule: string; direction: string; hits: number; total: number; returns: number[] }
    >();
    for (const row of rows) {
      const key = `${row.rule}:${row.direction}`;
      const entry =
        acc.get(key) ||
        { rule: row.rule, direction: row.direction, hits: 0, total: 0, returns: [] };
      entry.total += 1;
      if (row.outcome === 'hit') entry.hits += 1;
      if (row.returnPct != null) entry.returns.push(row.returnPct);
      acc.set(key, entry);
    }

    const byRule = [...acc.values()]
      .map((entry) => ({
        rule: entry.rule,
        ruleLabel: RULE_LABELS[entry.rule] || entry.rule,
        direction: entry.direction,
        total: entry.total,
        hits: entry.hits,
        hitRate: entry.total ? Math.round((entry.hits / entry.total) * 10000) / 100 : null,
        avgReturn: entry.returns.length
          ? Math.round((entry.returns.reduce((a, b) => a + b, 0) / entry.returns.length) * 100) / 100
          : null,
        learned: entry.total >= MIN_SAMPLES,
      }))
      .sort((a, b) => (b.hitRate ?? -1) - (a.hitRate ?? -1));

    return {
      total,
      pending,
      evaluated: total - pending,
      minSamples: MIN_SAMPLES,
      evalDays: EVAL_DAYS,
      byRule,
      best: byRule[0] || null,
      worst: byRule.length ? byRule[byRule.length - 1] : null,
    };
  }

  /** Estatísticas compactas para o prompt das dicas de ação. */
  async promptStats(tenantId: string): Promise<string> {
    const summary = await this.summary(tenantId);
    if (!summary.byRule.length) {
      return 'Ainda sem histórico avaliado das regras (primeiros sinais aguardando ~14 dias).';
    }
    return summary.byRule
      .slice(0, 5)
      .map(
        (r) =>
          `${r.ruleLabel} (${r.direction}): ${r.hitRate}% de acerto em ${r.total} casos` +
          (r.avgReturn != null ? `, retorno médio ${r.avgReturn}%` : '') +
          (r.learned ? '' : ' [amostra pequena]'),
      )
      .join('; ');
  }
}
