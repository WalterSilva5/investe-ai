import { Injectable } from '@nestjs/common';
// pdfkit é CommonJS; com esModuleInterop=false o default import vira undefined.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');
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

  async portfolioPdf(tenantId: string, portfolioId: string): Promise<Buffer> {
    const summary = await this.portfolios.summary(tenantId, portfolioId);
    const positions = await this.portfolios.positions(tenantId, portfolioId);

    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    const money = (value: number) =>
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

    doc.font('Helvetica-Bold').fontSize(22).fillColor('#111111').text('Relatório da Carteira');
    doc.moveDown(0.2);
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#666666')
      .text(`${summary.portfolio.name} · ${summary.portfolio.currency} · ${new Date().toLocaleDateString('pt-BR')}`);

    doc.moveDown(1);
    doc.fillColor('#111111').font('Helvetica-Bold').fontSize(13).text('Resumo');
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(10);
    doc.text(`Total investido: ${money(summary.totalInvested)}`);
    doc.text(`Valor atual: ${money(summary.totalValue)}`);
    doc.text(
      `Resultado: ${money(summary.pnl)} (${summary.pnlPct.toFixed(2)}%)`,
    );
    doc.text(`Posições: ${summary.positionsCount}`);

    doc.moveDown(1);
    doc.font('Helvetica-Bold').fontSize(13).text('Posições');
    doc.moveDown(0.3);

    const columns = [
      { key: 'symbol', label: 'Ativo', x: 48, width: 80 },
      { key: 'quantity', label: 'Qtd', x: 130, width: 50 },
      { key: 'averagePrice', label: 'Preço médio', x: 182, width: 80 },
      { key: 'invested', label: 'Investido', x: 264, width: 80 },
      { key: 'currentValue', label: 'Atual', x: 346, width: 80 },
      { key: 'pnl', label: 'Resultado', x: 428, width: 80 },
    ];

    let y = doc.y;
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#444444');
    for (const column of columns) {
      doc.text(column.label, column.x, y, { width: column.width });
    }
    y += 16;
    doc.moveTo(48, y - 4).lineTo(548, y - 4).strokeColor('#dddddd').stroke();
    doc.font('Helvetica').fontSize(9).fillColor('#111111');

    for (const position of positions.slice(0, 35)) {
      if (y > 730) {
        doc.addPage();
        y = 48;
      }
      doc.text(position.symbol, columns[0].x, y, { width: columns[0].width });
      doc.text(String(position.quantity), columns[1].x, y, { width: columns[1].width });
      doc.text(money(position.averagePrice), columns[2].x, y, { width: columns[2].width });
      doc.text(money(position.invested), columns[3].x, y, { width: columns[3].width });
      doc.text(money(position.currentValue), columns[4].x, y, { width: columns[4].width });
      doc.text(money(position.pnl), columns[5].x, y, { width: columns[5].width });
      y += 16;
    }

    doc.moveDown(1.5);
    doc.font('Helvetica-Bold').fontSize(13).text('Alocação por tipo');
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(10);
    for (const item of summary.allocation.byType) {
      doc.text(`${item.type}: ${money(item.value)} (${item.pct.toFixed(1)}%)`);
    }

    doc.moveDown(2);
    doc
      .font('Helvetica-Oblique')
      .fontSize(8.5)
      .fillColor('#777777')
      .text(
        'Relatório educacional e analítico. Não é recomendação de investimento. Valores de mercado podem estar defasados; confira a fonte e a data.',
        { align: 'left' },
      );

    doc.end();
    return done;
  }

  private escape(value: unknown): string {
    const text = String(value ?? '');
    if (/[",\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }
}
