import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { CreatePortfolioDto, UpdatePortfolioDto } from './dto/portfolio.dto';

export interface EnrichedPosition {
  id: string;
  assetId: string;
  symbol: string;
  name: string;
  type: string;
  quantity: number;
  averagePrice: number;
  invested: number;
  currentPrice: number;
  currentValue: number;
  pnl: number;
  pnlPct: number;
  hasMarketPrice: boolean;
}

@Injectable()
export class PortfoliosService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.portfolio.findMany({
      where: { tenantId },
      include: { accounts: true, _count: { select: { positions: true } } },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async create(tenantId: string, dto: CreatePortfolioDto) {
    if (dto.isDefault) {
      await this.prisma.portfolio.updateMany({
        where: { tenantId },
        data: { isDefault: false },
      });
    }
    return this.prisma.portfolio.create({
      data: {
        tenantId,
        name: dto.name,
        currency: dto.currency || 'BRL',
        isDefault: dto.isDefault ?? false,
      },
    });
  }

  async get(tenantId: string, id: string) {
    const portfolio = await this.prisma.portfolio.findFirst({
      where: { id, tenantId },
      include: { accounts: true },
    });
    if (!portfolio) throw new NotFoundException('Carteira não encontrada.');
    return portfolio;
  }

  async update(tenantId: string, id: string, dto: UpdatePortfolioDto) {
    await this.get(tenantId, id);
    if (dto.isDefault) {
      await this.prisma.portfolio.updateMany({
        where: { tenantId },
        data: { isDefault: false },
      });
    }
    return this.prisma.portfolio.update({ where: { id }, data: dto });
  }

  async remove(tenantId: string, id: string) {
    await this.get(tenantId, id);
    await this.prisma.portfolio.delete({ where: { id } });
    return { ok: true };
  }

  async addAccount(tenantId: string, portfolioId: string, dto: CreateAccountDto) {
    await this.get(tenantId, portfolioId);
    return this.prisma.account.create({
      data: {
        portfolioId,
        name: dto.name,
        institution: dto.institution,
        type: dto.type || 'BROKER',
      },
    });
  }

  async positions(tenantId: string, portfolioId: string): Promise<EnrichedPosition[]> {
    await this.get(tenantId, portfolioId);
    const positions = await this.prisma.position.findMany({
      where: { portfolioId },
      include: { asset: true },
      orderBy: { updatedAt: 'desc' },
    });

    return Promise.all(
      positions.map(async (position) => {
        const latest = await this.prisma.price.findFirst({
          where: { assetId: position.assetId },
          orderBy: { date: 'desc' },
        });
        const quantity = Number(position.quantity);
        const averagePrice = Number(position.averagePrice);
        const invested = Number(position.invested);
        const currentPrice = latest ? Number(latest.close) : averagePrice;
        const currentValue = quantity * currentPrice;
        const pnl = currentValue - invested;
        return {
          id: position.id,
          assetId: position.assetId,
          symbol: position.asset.symbol,
          name: position.asset.name,
          type: position.asset.type,
          quantity,
          averagePrice,
          invested,
          currentPrice,
          currentValue,
          pnl,
          pnlPct: invested > 0 ? (pnl / invested) * 100 : 0,
          hasMarketPrice: Boolean(latest),
        };
      }),
    );
  }

  async allocation(tenantId: string, portfolioId: string) {
    const positions = await this.positions(tenantId, portfolioId);
    const total = positions.reduce((sum, p) => sum + p.currentValue, 0);

    const byTypeMap = new Map<string, number>();
    for (const position of positions) {
      byTypeMap.set(position.type, (byTypeMap.get(position.type) || 0) + position.currentValue);
    }

    return {
      total,
      byType: [...byTypeMap.entries()]
        .map(([type, value]) => ({
          type,
          value,
          pct: total > 0 ? (value / total) * 100 : 0,
        }))
        .sort((a, b) => b.value - a.value),
      byAsset: positions
        .map((p) => ({
          symbol: p.symbol,
          name: p.name,
          type: p.type,
          value: p.currentValue,
          pct: total > 0 ? (p.currentValue / total) * 100 : 0,
        }))
        .sort((a, b) => b.value - a.value),
    };
  }

  async summary(tenantId: string, portfolioId: string) {
    const portfolio = await this.get(tenantId, portfolioId);
    const positions = await this.positions(tenantId, portfolioId);
    const totalInvested = positions.reduce((sum, p) => sum + p.invested, 0);
    const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0);
    const pnl = totalValue - totalInvested;
    return {
      portfolio: { id: portfolio.id, name: portfolio.name, currency: portfolio.currency },
      totalInvested,
      totalValue,
      pnl,
      pnlPct: totalInvested > 0 ? (pnl / totalInvested) * 100 : 0,
      positionsCount: positions.length,
      allocation: await this.allocation(tenantId, portfolioId),
    };
  }

  /** Contexto compacto para o agente de IA. */
  async aiContext(tenantId: string) {
    const portfolio =
      (await this.prisma.portfolio.findFirst({
        where: { tenantId, isDefault: true },
      })) ||
      (await this.prisma.portfolio.findFirst({
        where: { tenantId },
        orderBy: { createdAt: 'asc' },
      }));

    if (!portfolio) {
      return { hasPortfolio: false, message: 'Nenhuma carteira cadastrada.' };
    }

    const summary = await this.summary(tenantId, portfolio.id);
    const positions = await this.positions(tenantId, portfolio.id);

    return {
      hasPortfolio: true,
      portfolio: summary.portfolio,
      totalInvested: summary.totalInvested,
      totalValue: summary.totalValue,
      pnl: summary.pnl,
      pnlPct: summary.pnlPct,
      allocationByType: summary.allocation.byType,
      topPositions: positions
        .sort((a, b) => b.currentValue - a.currentValue)
        .slice(0, 10)
        .map((p) => ({
          symbol: p.symbol,
          name: p.name,
          type: p.type,
          quantity: p.quantity,
          currentValue: p.currentValue,
          pct: summary.totalValue > 0 ? (p.currentValue / summary.totalValue) * 100 : 0,
        })),
    };
  }
}
