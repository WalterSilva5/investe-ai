import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const start = this.monthStart();
    const [users, tenants, portfolios, transactions, usage, audits] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.tenant.count(),
      this.prisma.portfolio.count(),
      this.prisma.transaction.count(),
      this.prisma.aiUsage.aggregate({
        where: { createdAt: { gte: start } },
        _sum: { tokensIn: true, tokensOut: true, cost: true },
      }),
      this.prisma.auditEvent.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, action: true, entity: true, createdAt: true, tenantId: true },
      }),
    ]);

    return {
      counts: { users, tenants, portfolios, transactions },
      aiUsage: {
        tokensIn: usage._sum.tokensIn ?? 0,
        tokensOut: usage._sum.tokensOut ?? 0,
        cost: Number(usage._sum.cost ?? 0),
      },
      recentAudits: audits,
    };
  }

  async users() {
    const start = this.monthStart();
    const [users, usage] = await Promise.all([
      this.prisma.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          status: true,
          createdAt: true,
          memberships: {
            select: {
              role: true,
              tenant: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      this.prisma.aiUsage.groupBy({
        by: ['userId'],
        where: { createdAt: { gte: start } },
        _sum: { tokensIn: true, tokensOut: true },
      }),
    ]);

    const usageMap = new Map(
      usage.map((item) => [
        item.userId,
        (item._sum.tokensIn ?? 0) + (item._sum.tokensOut ?? 0),
      ]),
    );

    return users.map((user) => ({
      ...user,
      tokensThisMonth: usageMap.get(user.id) ?? 0,
    }));
  }

  async usage() {
    const start = this.monthStart();
    const grouped = await this.prisma.aiUsage.groupBy({
      by: ['tenantId'],
      where: { createdAt: { gte: start } },
      _sum: { tokensIn: true, tokensOut: true, cost: true },
    });
    const tenants = await this.prisma.tenant.findMany({
      where: { id: { in: grouped.map((item) => item.tenantId) } },
      select: { id: true, name: true },
    });
    const names = new Map(tenants.map((tenant) => [tenant.id, tenant.name]));

    return grouped
      .map((item) => ({
        tenantId: item.tenantId,
        tenantName: names.get(item.tenantId) ?? '—',
        tokensIn: item._sum.tokensIn ?? 0,
        tokensOut: item._sum.tokensOut ?? 0,
        cost: Number(item._sum.cost ?? 0),
      }))
      .sort((a, b) => b.tokensIn + b.tokensOut - (a.tokensIn + a.tokensOut));
  }

  private monthStart(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }
}
