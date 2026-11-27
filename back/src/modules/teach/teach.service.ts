import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { QuotesService } from '../market/quotes.service';
import { halvingContext } from '../market/halving';
import { LESSONS, ExerciseType, TRACK_LABELS, trackOf } from './lessons.content';

export interface LiveExerciseData {
  symbol: string;
  currency: string;
  current: number;
  trend: string;
  rsi14: number | null;
  support: number | null;
  resistance: number | null;
  ratio: number | null;
  labels: string[];
  values: number[];
  supports: number[];
  resistances: number[];
  ma20: number | null;
  ma50: number | null;
  /** Dias até o próximo halving (só BTC). */
  halvingDaysBeforeNext: number | null;
}

/**
 * Valida a resposta do exercício contra os DADOS ATUAIS do mercado.
 * Quiz usa gabarito fixo; numéricos têm tolerância (o mercado anda durante a
 * aula); categorias são exatas. Função pura para poder testar sem rede.
 */
export function validateExercise(
  exercise: { type: ExerciseType; answer?: string; explanation?: string },
  live: {
    trend: string;
    rsi14: number | null;
    support: number | null;
    resistance: number | null;
    ratio: number | null;
    halvingDaysBeforeNext: number | null;
  },
  rawAnswer: string,
): { correct: boolean; expected: string; explanation: string } {
  const answer = String(rawAnswer || '').trim().toLowerCase().replace('%', '').replace(':', '');
  const num = Number(answer.replace(',', '.'));

  switch (exercise.type) {
    case 'quiz': {
      const expected = String(exercise.answer || '').toLowerCase().trim();
      const ok = answer === expected;
      return {
        correct: ok,
        expected: String(exercise.answer || '—'),
        explanation: exercise.explanation || 'Revise a seção teórica desta aula.',
      };
    }
    case 'halving-days': {
      const expected = live.halvingDaysBeforeNext ?? 0;
      const ok = expected > 0 && Math.abs(num - expected) <= 25;
      return {
        correct: ok,
        expected: `~${expected} dias`,
        explanation: `Faltam ~${expected} dias para o próximo halving (estimado). Lembre: padrão observado nos ciclos, não garantia.`,
      };
    }
    case 'trend': {
      const expected = live.trend;
      const ok = ['alta', 'baixa', 'lateral'].includes(answer) && answer === expected;
      return {
        correct: ok,
        expected: `tendência ${expected}`,
        explanation: `O preço está ${
          expected === 'alta'
            ? 'acima das médias, com elas em escalera de alta'
            : expected === 'baixa'
              ? 'abaixo das médias, com elas em escalera de baixa'
              : 'no meio das médias, sem direção definida'
        }.`,
      };
    }
    case 'rsi-zone': {
      let expected = 'neutro';
      if (live.rsi14 != null) {
        if (live.rsi14 >= 70) expected = 'sobrecompra';
        else if (live.rsi14 <= 30) expected = 'sobrevenda';
      }
      const ok = answer === expected;
      return {
        correct: ok,
        expected: `RSI em ${expected} (${live.rsi14 ?? '—'})`,
        explanation: `RSI ${live.rsi14 ?? '—'}: acima de 70 é sobrecompra, abaixo de 30 é sobrevenda, no meio é neutro. Lembre: sobrevenda não é sinal de compra — é velocidade, não fundo.`,
      };
    }
    case 'support': {
      const expected = live.support ?? 0;
      const ok = expected > 0 && Math.abs(num - expected) / expected <= 0.03;
      return {
        correct: ok,
        expected: expected.toFixed(2),
        explanation: `Suporte mais próximo em ${expected.toFixed(2)} — a zona onde a queda historicamente desacelera. Observar rompimentos com volume forte.`,
      };
    }
    case 'resistance': {
      const expected = live.resistance ?? 0;
      const ok = expected > 0 && Math.abs(num - expected) / expected <= 0.03;
      return {
        correct: ok,
        expected: expected.toFixed(2),
        explanation: `Resistência mais próxima em ${expected.toFixed(2)} — onde a alta historicamente desacelera.`,
      };
    }
    case 'ratio': {
      const expected = live.ratio ?? 0;
      const ok = expected > 0 && Math.abs(num - expected) <= 0.3;
      const inFavor = expected >= 1.5;
      const choiceOk =
        (answer.includes('favor') && inFavor) || (answer.includes('contra') && !inFavor);
      const numericOk = !Number.isNaN(num) && Math.abs(num - expected) <= 0.3;
      const correct = ok || numericOk || choiceOk;
      return {
        correct,
        expected: `${expected.toFixed(2)}:1`,
        explanation: `Relação atual: ganho até a resistência ÷ risco até o suporte = ${expected.toFixed(
          2,
        )}:1. ${
          inFavor
            ? 'Acima de 1,5:1 — a conta está a favor.'
            : 'Abaixo de 1,5:1 — a conta está contra; em geral só vale com tese fora do gráfico.'
        }`,
      };
    }
    default:
      return { correct: false, expected: '—', explanation: 'Tipo de exercício desconhecido.' };
  }
}

@Injectable()
export class TeachService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quotes: QuotesService,
  ) {}

  /** Currículo agrupado por TRILHAS, com progresso do usuário. */
  async curriculum(tenantId: string) {
    const progress = await this.prisma.lessonProgress.findMany({ where: { tenantId } });
    const byId = new Map(progress.map((row) => [row.lessonId, row]));

    const trackOrder = Object.keys(TRACK_LABELS);
    const groups = new Map<string, Array<Record<string, unknown>>>();
    for (const lesson of LESSONS) {
      const track = trackOf(lesson);
      if (!groups.has(track)) groups.set(track, []);
      const row = byId.get(lesson.id);
      groups.get(track)!.push({
        id: lesson.id,
        emoji: lesson.emoji,
        title: lesson.title,
        summary: lesson.summary,
        attempts: row?.attempts ?? 0,
        correct: row?.correct ?? false,
        completed: Boolean(row?.completedAt),
      });
    }

    const tracks = trackOrder
      .filter((track) => groups.has(track))
      .map((track) => ({
        id: track,
        label: TRACK_LABELS[track] || track,
        lessons: groups.get(track)!,
        completed: groups.get(track)!.filter((l) => l.completed).length,
        total: groups.get(track)!.length,
      }));

    return {
      tracks,
      completed: progress.filter((row) => row.completedAt).length,
      total: LESSONS.length,
    };
  }

  /** Aula completa com dados de mercado AO VIVO para o exemplo e o exercício. */
  async lesson(tenantId: string, lessonId: string) {
    const lesson = LESSONS.find((item) => item.id === lessonId.toLowerCase());
    if (!lesson) throw new NotFoundException('Aula não encontrada.');
    const progress = await this.prisma.lessonProgress.findUnique({
      where: { tenantId_lessonId: { tenantId, lessonId: lesson.id } },
    });

    const data = await this.liveData(lesson.symbol).catch(() => null);
    return {
      ...lesson,
      progress: progress
        ? {
            attempts: progress.attempts,
            correct: progress.correct,
            completedAt: progress.completedAt,
          }
        : { attempts: 0, correct: false, completedAt: null },
      live: data,
      halving: lesson.symbol === 'BTC' ? halvingContext() : null,
    };
  }

  /** Valida a resposta e registra a tentativa. */
  async answer(tenantId: string, lessonId: string, value: string) {
    const lesson = LESSONS.find((item) => item.id === lessonId.toLowerCase());
    if (!lesson) throw new NotFoundException('Aula não encontrada.');
    const data = await this.liveData(lesson.symbol);
    const result = validateExercise(
      lesson.exercise,
      {
        trend: data.trend,
        rsi14: data.rsi14,
        support: data.support,
        resistance: data.resistance,
        ratio: data.ratio,
        halvingDaysBeforeNext: data.halvingDaysBeforeNext,
      },
      value,
    );
    const existing = await this.prisma.lessonProgress.findUnique({
      where: { tenantId_lessonId: { tenantId, lessonId: lesson.id } },
    });
    const row = await this.prisma.lessonProgress.upsert({
      where: { tenantId_lessonId: { tenantId, lessonId: lesson.id } },
      create: {
        tenantId,
        lessonId: lesson.id,
        attempts: 1,
        correct: result.correct,
        completedAt: result.correct ? new Date() : null,
      },
      update: {
        attempts: (existing?.attempts ?? 0) + 1,
        correct: result.correct || Boolean(existing?.correct),
        completedAt: result.correct || existing?.completedAt ? new Date() : null,
      },
    });
    return { ...result, attempts: row.attempts, done: Boolean(row.completedAt) };
  }

  /** Marca a aula como concluída (mesmo sem acertar o exercício de primeira). */
  async complete(tenantId: string, lessonId: string) {
    const lesson = LESSONS.find((item) => item.id === lessonId.toLowerCase());
    if (!lesson) throw new NotFoundException('Aula não encontrada.');
    const row = await this.prisma.lessonProgress.upsert({
      where: { tenantId_lessonId: { tenantId, lessonId: lesson.id } },
      create: {
        tenantId,
        lessonId: lesson.id,
        attempts: 0,
        correct: false,
        completedAt: new Date(),
      },
      update: { completedAt: new Date() },
    });
    return { ok: true, done: Boolean(row.completedAt) };
  }

  /** Dados ao vivo do símbolo da aula (mesma fonte do Tracking). */
  private async liveData(symbol: string): Promise<LiveExerciseData> {
    const data = (await this.quotes.indicators(symbol, '1y')) as {
      symbol: string;
      currency: string;
      current: number;
      ma20: number | null;
      ma50: number | null;
      rsi14: number | null;
      supports: number[];
      resistances: number[];
      points: Array<{ date: string; close: number }>;
    };
    // leitura de tendência igual ao Tracking (preço vs MM20/MM50)
    const current = data.current;
    const trend =
      data.ma20 != null && data.ma50 != null
        ? current > data.ma20 && data.ma20 > data.ma50
          ? 'alta'
          : current < data.ma20 && data.ma20 < data.ma50
            ? 'baixa'
            : 'lateral'
        : 'lateral';
    const ratio =
      data.supports?.[0] && data.resistances?.[0] && current > 0
        ? Math.round(((data.resistances[0] - current) / (current - data.supports[0])) * 100) / 100
        : null;

    return {
      symbol: data.symbol,
      currency: data.currency,
      current,
      trend,
      rsi14: data.rsi14,
      support: data.supports?.[0] ?? null,
      resistance: data.resistances?.[0] ?? null,
      ratio,
      labels: data.points.map((p) => p.date.slice(0, 10)),
      values: data.points.map((p) => p.close),
      supports: data.supports || [],
      resistances: data.resistances || [],
      ma20: data.ma20,
      ma50: data.ma50,
      halvingDaysBeforeNext: symbol === 'BTC' ? halvingContext().daysBeforeNext : null,
    };
  }
}
