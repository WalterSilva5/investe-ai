import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface AiUsageSummary {
  quota: number;
  used: number;
  remaining: number;
  percent: number;
  resetAt: string;
  unlimited: boolean;
}

@Injectable()
export class AiUsageService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(userId: string, tenantId: string): Promise<AiUsageSummary> {
    const start = this.monthStart();
    const aggregate = await this.prisma.aiUsage.aggregate({
      where: { userId, tenantId, createdAt: { gte: start } },
      _sum: { tokensIn: true, tokensOut: true },
    });
    const used = (aggregate._sum.tokensIn ?? 0) + (aggregate._sum.tokensOut ?? 0);
    const quota = this.quota();
    const unlimited = quota <= 0;
    return {
      quota,
      used,
      remaining: unlimited ? -1 : Math.max(0, quota - used),
      percent: unlimited || quota === 0 ? 0 : Math.min(100, (used / quota) * 100),
      resetAt: this.nextMonthStart().toISOString(),
      unlimited,
    };
  }

  async assertQuota(userId: string, tenantId: string): Promise<void> {
    const summary = await this.summary(userId, tenantId);
    if (!summary.unlimited && summary.used >= summary.quota) {
      throw new HttpException(
        `Quota mensal de IA atingida (${summary.used}/${summary.quota} tokens).`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private quota(): number {
    return Number(process.env.AI_MONTHLY_TOKEN_QUOTA || 0);
  }

  private monthStart(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }

  private nextMonthStart(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  }
}
