import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { QuotesService } from '../market/quotes.service';
import { CandidateInput, rankCandidates, reasonFor } from './ranking';
import { DISCOVERY_UNIVERSE } from './universe';

const CONCURRENCY = 4;

@Injectable()
export class DiscoveryService {
  private readonly logger = new Logger(DiscoveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly quotes: QuotesService,
  ) {}

  /** Watchlist do usuário (descobertos + adicionados à mão). */
  tracked(tenantId: string) {
    return this.prisma.trackedSymbol.findMany({
      where: { tenantId },
      orderBy: [{ score: 'desc' }, { symbol: 'asc' }],
    });
  }

  async track(tenantId: string, symbol: string, source = 'manual') {
    const clean = String(symbol || '').trim().toUpperCase();
    if (!clean) throw new NotFoundException('Informe o símbolo.');
    return this.prisma.trackedSymbol.upsert({
      where: { tenantId_symbol: { tenantId, symbol: clean } },
      create: { tenantId, symbol: clean, source },
      update: {},
    });
  }

  async untrack(tenantId: string, symbol: string) {
    const clean = String(symbol || '').trim().toUpperCase();
    await this.prisma.trackedSymbol.deleteMany({ where: { tenantId, symbol: clean } });
    return { ok: true };
  }

  /**
   * Varre o universo, pontua cada papel com os mesmos critérios do tracking e
   * grava os melhores na watchlist (upsert, preservando os já rastreados).
   */
  async scan(tenantId: string, limit = 8) {
    const started = Date.now();
    const inputs: CandidateInput[] = [];
    const failures: Array<{ symbol: string; error: string }> = [];

    for (let i = 0; i < DISCOVERY_UNIVERSE.length; i += CONCURRENCY) {
      const chunk = DISCOVERY_UNIVERSE.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        chunk.map(async (item): Promise<{ outlook: Awaited<ReturnType<QuotesService['outlook']>> } | { symbol: string; error: string }> => {
          try {
            const outlook = await this.quotes.outlook(item.symbol, '1y');
            return { outlook };
          } catch (error) {
            return {
              symbol: item.symbol,
              error: error instanceof Error ? error.message : 'falha',
            };
          }
        }),
      );

      for (const result of results) {
        if ('error' in result) {
          failures.push({ symbol: result.symbol, error: result.error });
          continue;
        }
        inputs.push({
          symbol: result.outlook.symbol,
          technicalScore: result.outlook.read.score,
          ratio: result.outlook.read.ratio,
          patternWinRate: result.outlook.pattern.winRate10,
          patternCompleted: result.outlook.pattern.completed10,
          rsi: result.outlook.read.rsi14,
        });
      }
    }

    const ranked = rankCandidates(inputs, limit);
    const saved: Array<Awaited<ReturnType<typeof this.prisma.trackedSymbol.upsert>>> = [];
    for (const candidate of ranked) {
      const note = reasonFor(candidate);
      const entry = await this.prisma.trackedSymbol.upsert({
        where: { tenantId_symbol: { tenantId, symbol: candidate.symbol } },
        create: {
          tenantId,
          symbol: candidate.symbol,
          source: 'discovered',
          score: candidate.composite,
          note,
        },
        update: { score: candidate.composite, note },
      });
      saved.push(entry);
    }

    this.logger.log(
      `Descoberta ${tenantId}: ${saved.length} papel(is) em ${Date.now() - started}ms, ${failures.length} falha(s).`,
    );
    return {
      scanned: inputs.length,
      failures,
      saved,
      durationMs: Date.now() - started,
    };
  }
}
