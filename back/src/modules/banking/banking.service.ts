import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PDFParse } from 'pdf-parse';
import { ImportStatementDto } from './dto/import-statement.dto';

interface ParsedTransaction {
  date: Date;
  description: string;
  amount: number;
  type: string;
  category?: string;
  raw?: string;
}

const CATEGORY_RULES: Array<{ category: string; keywords: string[] }> = [
  { category: 'Renda', keywords: ['salario', 'salário', 'prolabore', 'pró-labore', 'pagamento', 'recebimento', 'deposito', 'depósito', 'honorario', 'honorário'] },
  { category: 'Moradia', keywords: ['aluguel', 'condominio', 'condomínio', 'iptu', 'energia', 'luz', 'agua', 'água', 'gas', 'gás', 'internet', 'telefone'] },
  { category: 'Alimentação', keywords: ['supermercado', 'mercado', 'padaria', 'restaurante', 'ifood', 'delivery', 'lanche', 'acougue', 'açougue', 'feira', 'hortifruti'] },
  { category: 'Transporte', keywords: ['uber', '99', 'combustivel', 'combustível', 'posto', 'gasolina', 'etanol', 'estacionamento', 'pedagio', 'pedágio', 'onibus', 'ônibus', 'metro', 'metrô', 'transporte'] },
  { category: 'Saúde', keywords: ['farmacia', 'farmácia', 'medico', 'médico', 'consulta', 'plano de saude', 'plano de saúde', 'dentista', 'hospital', 'exame', 'clinica', 'clínica'] },
  { category: 'Educação', keywords: ['escola', 'faculdade', 'curso', 'livro', 'mensalidade', 'educacao', 'educação'] },
  { category: 'Assinaturas', keywords: ['netflix', 'spotify', 'amazon', 'prime', 'disney', 'hbo', 'streaming', 'assinatura', 'google', 'icloud', 'adobe'] },
  { category: 'Impostos e taxas', keywords: ['imposto', 'darf', 'das', 'taxa', 'multa', 'irpf', 'gov.br', 'receita federal', 'detran'] },
  { category: 'Investimentos', keywords: ['corretora', 'b3', 'tesouro', 'investimento', 'aporte', 'rendimento', 'dividendo', 'aplicacao', 'aplicação'] },
  { category: 'Cartão', keywords: ['fatura', 'cartao', 'cartão', 'credito', 'crédito'] },
  { category: 'Transferências', keywords: ['transferencia', 'transferência', 'pix', 'ted', 'doc'] },
];

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

  listCategories() {
    return CATEGORY_RULES.map((rule) => rule.category).concat('Outros');
  }

  async updateCategory(tenantId: string, id: string, category: string) {
    const transaction = await this.prisma.bankTransaction.findFirst({
      where: { id, statement: { tenantId } },
    });
    if (!transaction) throw new NotFoundException('Transação não encontrada.');
    return this.prisma.bankTransaction.update({
      where: { id },
      data: { category },
    });
  }

  /** Reaplica a categorização por regras nas transações ainda sem categoria. */
  async recategorize(tenantId: string) {
    const transactions = await this.prisma.bankTransaction.findMany({
      where: { statement: { tenantId }, category: null },
      select: { id: true, description: true },
    });
    for (const txn of transactions) {
      await this.prisma.bankTransaction.update({
        where: { id: txn.id },
        data: { category: this.categorize(txn.description) },
      });
    }
    return { updated: transactions.length };
  }

  async import(tenantId: string, dto: ImportStatementDto) {
    const text = dto.content;
    const parsed =
      dto.format.toUpperCase() === 'CSV' ? this.parseCsv(text) : this.parseOfx(text);
    return this.persist(tenantId, dto.name, dto.institution, dto.format, parsed);
  }

  async importFile(
    tenantId: string,
    input: { name: string; institution?: string; format: string; buffer: Buffer },
  ) {
    const format = input.format.toUpperCase();
    let parsed: ParsedTransaction[];
    if (format === 'PDF') {
      parsed = await this.parsePdf(input.buffer);
    } else {
      const text = input.buffer.toString('utf8');
      parsed = format === 'CSV' ? this.parseCsv(text) : this.parseOfx(text);
    }
    return this.persist(tenantId, input.name, input.institution, format, parsed);
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
    const byCategory = new Map<
      string,
      { category: string; income: number; expense: number; count: number }
    >();

    for (const txn of transactions) {
      const amount = Number(txn.amount);
      const category = txn.category || 'Outros';
      const key = txn.date.toISOString().slice(0, 7);
      const bucket = byMonth.get(key) || { month: key, income: 0, expense: 0, net: 0, count: 0 };
      const cat = byCategory.get(category) || { category, income: 0, expense: 0, count: 0 };

      if (amount >= 0) {
        income += amount;
        bucket.income += amount;
        cat.income += amount;
      } else {
        expense += amount;
        bucket.expense += amount;
        cat.expense += amount;
      }
      bucket.net = this.round2(bucket.income + bucket.expense);
      bucket.income = this.round2(bucket.income);
      bucket.expense = this.round2(bucket.expense);
      bucket.count += 1;
      cat.count += 1;
      cat.income = this.round2(cat.income);
      cat.expense = this.round2(cat.expense);

      byMonth.set(key, bucket);
      byCategory.set(category, cat);
    }

    return {
      period: { from: since.toISOString(), months },
      income: this.round2(income),
      expense: this.round2(expense),
      net: this.round2(income + expense),
      count: transactions.length,
      byMonth: Array.from(byMonth.values()).sort((a, b) => a.month.localeCompare(b.month)),
      byCategory: Array.from(byCategory.values()).sort((a, b) => b.expense - a.expense),
    };
  }

  // ── Persistência ─────────────────────────────────────────────────────────

  private async persist(
    tenantId: string,
    name: string,
    institution: string | undefined,
    source: string,
    parsed: ParsedTransaction[],
  ) {
    if (!parsed.length) {
      throw new BadRequestException(
        'Nenhuma transação encontrada. Confira o formato (OFX/CSV/PDF) e o conteúdo.',
      );
    }

    const dates = parsed.map((item) => item.date.getTime());
    const periodStart = new Date(Math.min(...dates));
    const periodEnd = new Date(Math.max(...dates));

    const statement = await this.prisma.bankStatement.create({
      data: {
        tenantId,
        name: name.trim(),
        institution: institution?.trim() || null,
        source: source.toUpperCase(),
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
        category: this.categorize(item.description),
        raw: item.raw?.slice(0, 1000) || null,
      })),
    });

    return { statement, imported: parsed.length };
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
      ['date', 'data', 'amount', 'valor', 'description', 'descricao', 'historico', 'lancamento'].includes(h),
    );
    const rows = hasHeader ? lines.slice(1) : lines;

    const aliases: Record<string, string[]> = {
      date: ['date', 'data', 'lancamento'],
      description: ['description', 'descricao', 'historico', 'memo', 'detalhe', 'observacao'],
      amount: ['amount', 'valor', 'montante'],
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
      const date = this.parseDateFlexible(dateRaw);
      if (!date) continue;
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

  private async parsePdf(buffer: Buffer): Promise<ParsedTransaction[]> {
    let parser: PDFParse | undefined;
    try {
      parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      return this.extractPdfTransactions(result.text);
    } catch (error) {
      throw new BadRequestException(
        `Não foi possível extrair texto do PDF: ${(error as Error).message}. PDFs escaneados (imagem) exigem OCR.`,
      );
    } finally {
      await parser?.destroy();
    }
  }

  private extractPdfTransactions(text: string): ParsedTransaction[] {
    const items: ParsedTransaction[] = [];
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    for (const line of lines) {
      // padrão: "DD/MM[/AAAA] descrição valor [C|D]"
      const m = line.match(/^(\d{2}\/\d{2}(?:\/\d{4})?)\s+(.+?)\s+(-?[\d.,]+)\s*([CDcd])?$/);
      if (!m) continue;
      const date = this.parseBrDate(m[1]);
      if (!date) continue;
      let amount = this.parseAmount(m[3]);
      const flag = m[4]?.toUpperCase();
      if (flag === 'D') amount = -Math.abs(amount);
      if (flag === 'C') amount = Math.abs(amount);
      items.push({
        date,
        description: m[2].trim(),
        amount,
        type: amount >= 0 ? 'INCOME' : 'EXPENSE',
        raw: line,
      });
    }
    return items;
  }

  private categorize(description: string): string {
    const value = (description || '').toLowerCase();
    for (const rule of CATEGORY_RULES) {
      if (rule.keywords.some((keyword) => value.includes(keyword))) return rule.category;
    }
    return 'Outros';
  }

  private tag(block: string, name: string): string {
    // OFX 1.x é SGML: tags como <DTPOSTED>20261005 não têm fechamento.
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

  private parseBrDate(raw: string): Date | null {
    const [d, m, y] = raw.split('/');
    const year = y ? Number(y) : new Date().getFullYear();
    const date = new Date(Date.UTC(year, Number(m) - 1, Number(d)));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private parseDateFlexible(raw: string): Date | null {
    const normalized = raw.trim();
    if (/^\d{2}\/\d{2}(\/\d{4})?$/.test(normalized)) return this.parseBrDate(normalized);
    const date = new Date(normalized);
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

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
