import { Injectable, NotFoundException } from '@nestjs/common';
import { TransactionType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, portfolioId: string) {
    await this.assertPortfolio(tenantId, portfolioId);
    return this.prisma.transaction.findMany({
      where: { portfolioId },
      include: { asset: true, account: true },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 500,
    });
  }

  async create(tenantId: string, portfolioId: string, dto: CreateTransactionDto) {
    await this.assertPortfolio(tenantId, portfolioId);

    const asset = await this.prisma.asset.findUnique({ where: { id: dto.assetId } });
    if (!asset) throw new NotFoundException('Ativo não encontrado.');

    const transaction = await this.prisma.transaction.create({
      data: {
        portfolioId,
        accountId: dto.accountId,
        assetId: dto.assetId,
        type: dto.type,
        quantity: dto.quantity,
        price: dto.price,
        fees: dto.fees ?? 0,
        date: new Date(dto.date),
        notes: dto.notes,
      },
      include: { asset: true },
    });

    await this.recomputePosition(portfolioId, dto.assetId);
    return transaction;
  }

  async remove(tenantId: string, transactionId: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { portfolio: true },
    });
    if (!transaction || transaction.portfolio.tenantId !== tenantId) {
      throw new NotFoundException('Transação não encontrada.');
    }

    await this.prisma.transaction.delete({ where: { id: transactionId } });
    await this.recomputePosition(transaction.portfolioId, transaction.assetId);
    return { ok: true };
  }

  /**
   * Recalcula a posição a partir de todas as transações do ativo.
   * BUY soma quantidade e custo; SELL reduz pela média; proventos não alteram.
   */
  async recomputePosition(portfolioId: string, assetId: string) {
    const transactions = await this.prisma.transaction.findMany({
      where: { portfolioId, assetId },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    });

    let quantity = 0;
    let averagePrice = 0;
    let invested = 0;

    for (const tx of transactions) {
      const qty = Number(tx.quantity);
      const price = Number(tx.price);
      const fees = Number(tx.fees);

      if (tx.type === TransactionType.BUY) {
        invested += qty * price + fees;
        quantity += qty;
        averagePrice = quantity > 0 ? invested / quantity : 0;
      } else if (tx.type === TransactionType.SELL) {
        quantity = Math.max(0, quantity - qty);
        if (quantity === 0) {
          averagePrice = 0;
          invested = 0;
        } else {
          invested = quantity * averagePrice;
        }
      }
    }

    if (quantity <= 0) {
      await this.prisma.position.deleteMany({ where: { portfolioId, assetId } });
      return null;
    }

    return this.prisma.position.upsert({
      where: { portfolioId_assetId: { portfolioId, assetId } },
      create: { portfolioId, assetId, quantity, averagePrice, invested },
      update: { quantity, averagePrice, invested },
    });
  }

  private async assertPortfolio(tenantId: string, portfolioId: string) {
    const portfolio = await this.prisma.portfolio.findFirst({
      where: { id: portfolioId, tenantId },
    });
    if (!portfolio) throw new NotFoundException('Carteira não encontrada.');
    return portfolio;
  }
}
