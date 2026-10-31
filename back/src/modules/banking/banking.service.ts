import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ImportStatementDto } from './dto/import-statement.dto';

interface ParsedTransaction {
  date: Date;
  description: string;
  amount: number;
  type: string;
  raw?: string;
}

@Injectable()
export class BankingService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.bankStatement.findMany({
      where: { tenantId },
      orderBy: { importedAt: 'desc' },
      include: { _count: { select: { transactions: true } } },
    });
  }

  async get(tenantId: string, id: string) {
    const statement = await this.prisma.bankStatement.findFirst({
      where: { id, tenantId },
      include: { transactions: { orderBy: { date: 'asc' } } },
    });
    if (!statement) throw new NotFoundException('Extrato não encontrado.');
    return statement;
  }

  async remove(tenantId: string, id: string) {
    const statement = await this.prisma.bankStatement.findFirst({ where: { id, tenantId } });
    if (!statement) throw new NotFoundException('Extrato não encontrado.');
    await this.prisma.bankStatement.delete({ where: { id } });
    return { ok: true };
  }

  async import(tenantId: string, dto: ImportStatementDto) {
    const parsed =
      dto.format.toUpperCase() === 'OFX' ? this.parseOfx(dto.content) : this.parseCsv(dto.content);

    if (!parsed.length) {
      throw new BadRequestException(
        'Nenhuma transação encontrada. Confira o formato (OFX/CSV) e o conteúdo.',
      );
    }

    const dates = parsed.map((item) => item.date.getTime());
    const periodStart = new Date(Math.min(...dates));
    const periodEnd = new Date(Math.max(...dates));

    const statement = await this.prisma.bankStatement.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        institution: dto.institution?.trim() || null,
        source: dto.format.toUpperCase(),
        periodStart,
        periodEnd,
      },
    });

    await this.prisma.bankTransaction.createMany({
      data: parsed.map((item) => ({
        statementId: statement.id,
        date: item.date,
        description: item.description.slice(0, 255),
        amount: item.amount,
        type: item.type,
        raw: item.raw?.slice(0, 1000) || null,
      })),
    });

    return { statement, imported: parsed.length };
  }

  async summary(tenantId: string, months = 6) {
    const since = new Date();
    since.setMonth(since.getMonth() - Math.max(1, Math.min(24, months)));
    since.setDate(1);
    since.setUTCHours(0, 0, 0, 0);

    const transactions = await this.prisma.bankTransaction.findMany({
      where: { statement: { tenantId }, date: { gte: since } },
      orderBy: { date: 'asc' },
    });

    let income = 0;
    let expense = 0;
    const byMonth = new Map<
      string,
      { month: string; income: number; expense: number; net: number; count: number }
    >();

    for (const txn of transactions) {
      const amount = Number(txn.amount);
      const key = txn.date.toISOString().slice(0, 7);
      const bucket = byMonth.get(key) || { month: key, income: 0, expense: 0, net: 0, count: 0 };
      if (amount >= 0) {
        income += amount;
        bucket.income += amount;
      } else {
        expense += amount;
        bucket.expense += amount;
      }
      bucket.net = this.round2(bucket.income + bucket.expense);
      bucket.income = this.round2(bucket.income);
      bucket.expense = this.round2(bucket.expense);
      bucket.count += 1;
      byMonth.set(key, bucket);
    }

    return {
      period: { from: since.toISOString(), months },
      income: this.round2(income),
      expense: this.round2(expense),
      net: this.round2(income + expense),
      count: transactions.length,
      byMonth: Array.from(byMonth.values()).sort((a, b) => a.month.localeCompare(b.month)),
    };
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  // ── Parsers ──────────────────────────────────────────────────────────────

  private parseOfx(content: string): ParsedTransaction[] {
    const blocks = content.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/g) || [];
    const items: ParsedTransaction[] = [];
    for (const block of blocks) {
      const date = this.ofxDate(this.tag(block, 'DTPOSTED'));
      const amountRaw = this.tag(block, 'TRNAMT');
      const description = this.tag(block, 'MEMO') || this.tag(block, 'NAME') || this.tag(block, 'TRNTYPE');
      if (!date || !amountRaw) continue;
      const amount = this.parseAmount(amountRaw);
      items.push({
        date,
        description: description || 'Sem descrição',
        amount,
        type: amount >= 0 ? 'INCOME' : 'EXPENSE',
        raw: block,
      });
    }
    return items;
  }

  private parseCsv(content: string): ParsedTransaction[] {
    const lines = content
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) return [];

    const header = this.csvLine(lines[0]).map((h) => h.toLowerCase().trim());
    const hasHeader = header.some((h) =>
      ['date', 'data', 'amount', 'valor', 'description', 'descricao', 'historico'].includes(h),
    );
    const rows = hasHeader ? lines.slice(1) : lines;

    const aliases: Record<string, string[]> = {
      date: ['date', 'data'],
      description: ['description', 'descricao', 'historico', 'memo'],
      amount: ['amount', 'valor'],
    };
    const indexOf = (key: string): number => {
      if (hasHeader) {
        for (const alias of aliases[key]) {
          const i = header.indexOf(alias);
          if (i >= 0) return i;
        }
        return -1;
      }
      return key === 'date' ? 0 : key === 'description' ? 1 : 2;
    };
    const dateCol = indexOf('date');
    const descCol = indexOf('description');
    const amountCol = indexOf('amount');

    const items: ParsedTransaction[] = [];
    for (const line of rows) {
      const cols = this.csvLine(line);
      const dateRaw = dateCol >= 0 ? cols[dateCol] : undefined;
      const desc = descCol >= 0 ? cols[descCol] : undefined;
      const amountRaw = amountCol >= 0 ? cols[amountCol] : undefined;
      if (!dateRaw || !desc || amountRaw == null || amountRaw === '') continue;
      const date = new Date(dateRaw);
      if (Number.isNaN(date.getTime())) continue;
      const amount = this.parseAmount(amountRaw);
      items.push({
        date,
        description: desc,
        amount,
        type: amount >= 0 ? 'INCOME' : 'EXPENSE',
        raw: line,
      });
    }
    return items;
  }

  private tag(block: string, name: string): string {
    // OFX 1.x é SGML: tags como <DTPOSTED>20261005 não têm fechamento.
    // Captura o valor até a próxima tag; funciona também para OFX 2.x (XML).
    const m = block.match(new RegExp(`<${name}>([^<]*)`, 'i'));
    return m ? m[1].trim() : '';
  }

  private ofxDate(raw: string): Date | null {
    const m = raw.replace(/\[.*\]/, '').match(/(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?/);
    if (!m) return null;
    const date = new Date(
      Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)),
    );
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private parseAmount(raw: string): number {
    const s = raw.trim();
    if (s.includes(',')) {
      return Number(s.replace(/\./g, '').replace(',', '.'));
    }
    return Number(s);
  }

  private csvLine(line: string): string[] {
    const out: string[] = [];
    let current = '';
    let quoted = false;
    for (const char of line) {
      if (char === '"') {
        quoted = !quoted;
      } else if ((char === ',' || char === ';') && !quoted) {
        out.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    out.push(current.trim());
    return out;
  }
}
