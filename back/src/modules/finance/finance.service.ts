import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Assistente financeiro: livros de 'pessoal' e 'empresa' com caixa atual,
 * reserva de emergência e fluxo de receitas/despesas. O objetivo é o agente
 * saber QUANTO há de caixa disponível para investir antes de sugerir algo —
 * dica sem contexto de caixa é dica vazia.
 */

const BOOK_KINDS = ['pessoal', 'empresa'] as const;
const SURPLUS_WINDOW_DAYS = 90;

export interface BookView {
  id: string;
  kind: string;
  label: string;
  cashBalance: number;
  emergencyReserve: number;
  investable: number;
  monthlyIncome: number;
  monthlyExpense: number;
  monthlySurplus: number;
  runwayMonths: number | null;
}

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  /** Garante os dois livros padrão (pessoal + empresa) do tenant. */
  async ensureBooks(tenantId: string) {
    const existing = await this.prisma.financeBook.findMany({ where: { tenantId } });
    const have = new Set(existing.map((book) => book.kind));
    for (const kind of BOOK_KINDS) {
      if (have.has(kind)) continue;
      await this.prisma.financeBook.create({
        data: {
          tenantId,
          kind,
          label: kind === 'pessoal' ? 'Pessoal' : 'Empresa',
        },
      });
    }
    return this.prisma.financeBook.findMany({
      where: { tenantId },
      orderBy: { kind: 'asc' },
    });
  }

  /** Resumo consolidado por livro + total disponível para investir. */
  async summary(tenantId: string) {
    const books = await this.ensureBooks(tenantId);
    const views = await Promise.all(books.map((book) => this.bookView(book)));
    const cashTotal = views.reduce((acc, b) => acc + b.cashBalance, 0);
    const reserved = views.reduce((acc, b) => acc + b.emergencyReserve, 0);
    return {
      books: views,
      cashTotal,
      reserved,
      investable: Math.max(0, cashTotal - reserved),
      monthlySurplus: views.reduce((acc, b) => acc + b.monthlySurplus, 0),
      hasData: views.some((b) => b.cashBalance > 0 || b.monthlyIncome > 0 || b.monthlyExpense > 0),
    };
  }

  /** Contexto compacto para o system prompt dos agentes (sem HTML, só dados). */
  async aiContext(tenantId: string) {
    const summary = await this.summary(tenantId);
    if (!summary.hasData) {
      return { hasFinance: false, message: 'Finanças não cadastradas — peça para cadastrar em "Finanças".' };
    }
    return {
      hasFinance: true,
      cashTotal: round2(summary.cashTotal),
      reserved: round2(summary.reserved),
      investable: round2(summary.investable),
      monthlySurplus: round2(summary.monthlySurplus),
      books: summary.books.map((b) => ({
        kind: b.kind,
        label: b.label,
        caixa: round2(b.cashBalance),
        reserva: round2(b.emergencyReserve),
        disponivelParaInvestir: round2(b.investable),
        receitaMensal: round2(b.monthlyIncome),
        despesaMensal: round2(b.monthlyExpense),
        excedenteMensal: round2(b.monthlySurplus),
        runwayMeses: b.runwayMonths,
      })),
    };
  }

  listBooks(tenantId: string) {
    return this.prisma.financeBook.findMany({
      where: { tenantId },
      orderBy: { kind: 'asc' },
      include: { entries: { orderBy: { date: 'desc' }, take: 50 } },
    });
  }

  /** Lançamentos de um livro (mais recentes primeiro). */
  async listEntries(tenantId: string, bookId: string, limit = 50) {
    const book = await this.prisma.financeBook.findFirst({ where: { id: bookId, tenantId } });
    if (!book) throw new NotFoundException('Livro financeiro não encontrado.');
    return this.prisma.financeEntry.findMany({
      where: { bookId },
      orderBy: { date: 'desc' },
      take: Math.min(200, Math.max(1, limit)),
    });
  }

  async updateBook(
    tenantId: string,
    id: string,
    input: { label?: string; cashBalance?: number; emergencyReserve?: number },
  ) {
    const book = await this.prisma.financeBook.findFirst({ where: { id, tenantId } });
    if (!book) throw new NotFoundException('Livro financeiro não encontrado.');
    if (input.cashBalance != null && input.cashBalance < 0) {
      throw new BadRequestException('Caixa não pode ser negativo.');
    }
    if (input.emergencyReserve != null && input.emergencyReserve < 0) {
      throw new BadRequestException('Reserva não pode ser negativa.');
    }
    return this.prisma.financeBook.update({
      where: { id },
      data: {
        ...(input.label != null ? { label: input.label.slice(0, 60) } : {}),
        ...(input.cashBalance != null ? { cashBalance: input.cashBalance } : {}),
        ...(input.emergencyReserve != null ? { emergencyReserve: input.emergencyReserve } : {}),
      },
    });
  }

  async addEntry(
    tenantId: string,
    bookId: string,
    input: { kind: string; amount: number; category?: string; note?: string; date?: string },
  ) {
    const book = await this.prisma.financeBook.findFirst({ where: { id: bookId, tenantId } });
    if (!book) throw new NotFoundException('Livro financeiro não encontrado.');
    if (input.kind !== 'income' && input.kind !== 'expense') {
      throw new BadRequestException('Tipo inválido: use income ou expense.');
    }
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Valor precisa ser positivo.');
    }
    return this.prisma.financeEntry.create({
      data: {
        bookId,
        kind: input.kind,
        amount,
        category: input.category?.slice(0, 40),
        note: input.note?.slice(0, 200),
        date: input.date ? new Date(input.date) : new Date(),
      },
    });
  }

  async removeEntry(tenantId: string, entryId: string) {
    const entry = await this.prisma.financeEntry.findFirst({
      where: { id: entryId },
      include: { book: true },
    });
    if (!entry || entry.book.tenantId !== tenantId) {
      throw new NotFoundException('Lançamento não encontrado.');
    }
    await this.prisma.financeEntry.delete({ where: { id: entryId } });
    return { removed: true };
  }

  /** Visão de um livro: caixa, reserva, fluxo médio mensal (90d) e runway. */
  private async bookView(book: {
    id: string;
    kind: string;
    label: string;
    cashBalance: any;
    emergencyReserve: any;
  }): Promise<BookView> {
    const since = new Date(Date.now() - SURPLUS_WINDOW_DAYS * 24 * 3600 * 1000);
    const entries = await this.prisma.financeEntry.findMany({
      where: { bookId: book.id, date: { gte: since } },
      select: { kind: true, amount: true },
    });
    const months = SURPLUS_WINDOW_DAYS / 30;
    const income = entries
      .filter((e) => e.kind === 'income')
      .reduce((acc, e) => acc + Number(e.amount), 0);
    const expense = entries
      .filter((e) => e.kind === 'expense')
      .reduce((acc, e) => acc + Number(e.amount), 0);
    const monthlyIncome = income / months;
    const monthlyExpense = expense / months;
    const cash = Number(book.cashBalance);
    const reserve = Math.min(Number(book.emergencyReserve), cash);
    return {
      id: book.id,
      kind: book.kind,
      label: book.label,
      cashBalance: cash,
      emergencyReserve: reserve,
      investable: Math.max(0, cash - reserve),
      monthlyIncome,
      monthlyExpense,
      monthlySurplus: monthlyIncome - monthlyExpense,
      runwayMonths: monthlyExpense > 0 ? round2((cash - reserve) / monthlyExpense) : null,
    };
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
