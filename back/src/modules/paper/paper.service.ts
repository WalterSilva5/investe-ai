import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { QuotesService } from '../market/quotes.service';
import { MacroService } from '../market/macro.service';

/** Tamanho padrão do lote simulado em cada proposta executada no paper. */
const DEFAULT_QUANTITY = 100;
/** Prioridade base das dicas de ação; o destaque do dia vale mais. */
const SCORE_BASE = 60;
const SCORE_HIGHLIGHT = 80;

/** Palavras que indicam sugestão de saída/redução (a dica vira SELL). */
const REDUCE_PATTERN = /reduz|vender|vend[ae]|realiz|zerar|sair d|cortar|diminuir/i;

interface DigestAction {
  ticker?: string;
  theme?: string;
  action?: string;
  why?: string;
  trigger?: string;
  verdict?: string;
  highlight?: boolean;
}

@Injectable()
export class PaperService {
  private readonly logger = new Logger(PaperService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly quotes: QuotesService,
    private readonly macro: MacroService,
  ) {}

  /**
   * Gera propostas de ordem a partir do último digest de dicas de ação.
   * Só dicas com veredito "Oportunidade" e ticker entram; a execução é
   * imediata e simulada no paper (paperPrice = cotação atual).
   */
  async generateFromDigest(tenantId: string) {
    const digest = await this.prisma.actionDigest.findFirst({
      where: { tenantId },
      orderBy: { generatedAt: 'desc' },
    });
    if (!digest) {
      return { created: 0, skipped: 0, message: 'Nenhum digest de dicas de ação ainda.' };
    }

    const actions = (Array.isArray(digest.actions) ? digest.actions : []) as DigestAction[];
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    // Dedupe por símbolo no mesmo dia: evita duplicar a mesma ordem em gerações repetidas.
    const existing = await this.prisma.orderProposal.findMany({
      where: { tenantId, createdAt: { gte: dayStart } },
      select: { symbol: true },
    });
    const alreadyToday = new Set(existing.map((row) => row.symbol));

    let created = 0;
    let skipped = 0;
    for (const action of actions) {
      const symbol = String(action.ticker || '').trim().toUpperCase();
      if (!symbol) {
        // Dica de tema sem ticker: nada de ordem simulada para ela.
        skipped += 1;
        continue;
      }
      if (action.verdict !== 'Oportunidade') {
        skipped += 1;
        continue;
      }
      if (alreadyToday.has(symbol)) {
        skipped += 1;
        continue;
      }

      const side = REDUCE_PATTERN.test(`${action.action || ''} ${action.why || ''}`)
        ? 'SELL'
        : 'BUY';
      try {
        const quote = await this.quotes.getQuote(symbol);
        const now = new Date();
        await this.prisma.orderProposal.create({
          data: {
            tenantId,
            symbol,
            side,
            quantity: DEFAULT_QUANTITY,
            price: quote.price,
            score: action.highlight ? SCORE_HIGHLIGHT : SCORE_BASE,
            rule: 'action-tips',
            verdict: action.verdict,
            reason: [action.why, action.trigger].filter(Boolean).join(' · ').slice(0, 500) || null,
            status: 'paper',
            executedAt: now,
            paperPrice: quote.price,
          },
        });
        alreadyToday.add(symbol);
        created += 1;
      } catch (error) {
        // Sem cotação agora: a dica fica de fora desta rodada (sem preço não há paper).
        this.logger.warn(`Paper ${tenantId}: sem cotação para ${symbol} — ignorado.`);
        skipped += 1;
      }
    }

    this.logger.log(`Paper ${tenantId}: ${created} proposta(s) criada(s), ${skipped} ignorada(s).`);
    return { created, skipped, digest: { title: digest.title, generatedAt: digest.generatedAt } };
  }

  /** Propostas + posições simuladas do paper, com retorno e comparação com o CDI. */
  async portfolio(tenantId: string) {
    const proposals = await this.prisma.orderProposal.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // Posições: agrega as propostas ainda em paper por símbolo (líquido).
    const symbols = [...new Set(
      proposals.filter((p) => p.status === 'paper').map((p) => p.symbol),
    )];
    const priceBySymbol = new Map<string, number | null>();
    await Promise.all(symbols.map(async (symbol) => {
      try {
        const quote = await this.quotes.getQuote(symbol);
        priceBySymbol.set(symbol, quote.price);
      } catch {
        priceBySymbol.set(symbol, null);
      }
    }));

    const positions = symbols.map((symbol) => {
      const rows = proposals.filter((p) => p.status === 'paper' && p.symbol === symbol);
      const buys = rows.filter((p) => p.side === 'BUY');
      const sells = rows.filter((p) => p.side === 'SELL');
      const buyCost = buys.reduce((acc, p) => acc + p.quantity * (p.paperPrice ?? p.price), 0);
      const buyQty = buys.reduce((acc, p) => acc + p.quantity, 0);
      const sellQty = sells.reduce((acc, p) => acc + p.quantity, 0);
      const sellProceeds = sells.reduce(
        (acc, p) => acc + p.quantity * (p.paperPrice ?? p.price), 0);
      const netQty = buyQty - sellQty;
      const invested = buyCost - sellProceeds;
      const currentPrice = priceBySymbol.get(symbol) ?? null;
      const currentValue = currentPrice != null ? netQty * currentPrice : null;
      const pnl = currentValue != null ? currentValue - invested : null;
      const averagePrice = buyQty > 0 ? buyCost / buyQty : 0;
      return {
        symbol,
        netQty,
        invested,
        averagePrice,
        currentPrice,
        currentValue,
        pnl,
        pnlPct: pnl != null && invested > 0 ? Math.round((pnl / invested) * 10000) / 100 : null,
      };
    });

    const totalInvested = positions.reduce((acc, p) => acc + p.invested, 0);
    const totalCurrent = positions.reduce(
      (acc, p) => acc + (p.currentValue ?? 0), 0);
    const totalPnl = positions.reduce((acc, p) => acc + (p.pnl ?? 0), 0);
    const returnPct = totalInvested > 0
      ? Math.round((totalPnl / totalInvested) * 10000) / 100
      : 0;

    // CDI pro-rata por dias corridos desde a primeira execução do paper.
    const executed = proposals.filter((p) => p.executedAt);
    const firstAt = executed.length
      ? executed.reduce((min, p) => (p.executedAt! < min ? p.executedAt! : min), executed[0].executedAt!)
      : null;
    const macro = await this.macro.getMacro().catch(() => null);
    const cdiAnnual = macro
      ? Number((macro as { cdiAnnual?: number }).cdiAnnual) || 0
      : 0;
    const days = firstAt
      ? Math.max(1, Math.ceil((Date.now() - new Date(firstAt).getTime()) / 86_400_000))
      : 0;
    const cdiReturnPct = days > 0
      ? Math.round(((Math.pow(1 + cdiAnnual / 100, days / 365) - 1) * 100) * 100) / 100
      : 0;

    return {
      proposals,
      positions,
      totals: {
        invested: totalInvested,
        current: totalCurrent,
        pnl: totalPnl,
        returnPct,
        positions: positions.length,
      },
      cdi: { cdiAnnual, days, returnPct: cdiReturnPct },
    };
  }

  /** Recusa a proposta: sai da fila e não entra no paper. */
  async reject(id: string) {
    const proposal = await this.prisma.orderProposal.findUnique({ where: { id } });
    if (!proposal) throw new NotFoundException('Proposta não encontrada.');
    if (proposal.status !== 'paper') {
      throw new NotFoundException('Proposta já processada.');
    }
    await this.prisma.orderProposal.update({
      where: { id },
      data: { status: 'rejected' },
    });
    return { ok: true };
  }

  /** Remove a proposta do histórico. */
  async remove(id: string) {
    const proposal = await this.prisma.orderProposal.findUnique({ where: { id } });
    if (!proposal) throw new NotFoundException('Proposta não encontrada.');
    await this.prisma.orderProposal.delete({ where: { id } });
    return { ok: true };
  }
}
