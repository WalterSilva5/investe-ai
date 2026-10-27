import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PortfoliosService } from '../portfolios/portfolios.service';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly portfolios: PortfoliosService,
  ) {}

  async portfolioCsv(tenantId: string, portfolioId: string): Promise<string> {
    const summary = await this.portfolios.summary(tenantId, portfolioId);
    const positions = await this.portfolios.positions(tenantId, portfolioId);
    const transactions = await this.prisma.transaction.findMany({
      where: { portfolioId },
      include: { asset: true },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });

    const lines: string[] = [];
    const row = (...values: unknown[]) => lines.push(values.map((v) => this.escape(v)).join(','));
    const money = (value: number) => value.toFixed(2);

    row('RELATORIO DA CARTEIRA');
    row('Carteira', summary.portfolio.name, summary.portfolio.currency);
    row('Gerado em', new Date().toISOString());
    row('Total investido', money(summary.totalInvested));
    row('Valor atual', money(summary.totalValue));
    row('Resultado', money(summary.pnl));
    row('Resultado %', money(summary.pnlPct));
    row('Posicoes', summary.positionsCount);
    row('');

    row('POSICOES');
    row('Ativo', 'Nome', 'Tipo', 'Qtd', 'Preco medio', 'Investido', 'Valor atual', 'Resultado', 'Resultado %');
    for (const p of positions) {
      row(
        p.symbol,
        p.name,
        p.type,
        p.quantity,
        money(p.averagePrice),
        money(p.invested),
        money(p.currentValue),
        money(p.pnl),
        money(p.pnlPct),
      );
    }
    row('');

    row('ALOCACAO POR TIPO');
    row('Tipo', 'Valor', '%');
    for (const item of summary.allocation.byType) {
      row(item.type, money(item.value), money(item.pct));
    }
    row('');

    row('TRANSACOES');
    row('Data', 'Tipo', 'Ativo', 'Qtd', 'Preco', 'Taxas', 'Observacao');
    for (const t of transactions) {
      row(
        t.date.toISOString().slice(0, 10),
        t.type,
        t.asset.symbol,
        t.quantity,
        money(Number(t.price)),
        money(Number(t.fees)),
        t.notes ?? '',
      );
    }

    return `\uFEFF${lines.join('\n')}`;
  }

  private escape(value: unknown): string {
    const text = String(value ?? '');
    if (/[",\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }
}
