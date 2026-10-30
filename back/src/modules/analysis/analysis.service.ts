import { Injectable } from '@nestjs/common';
import { PortfoliosService } from '../portfolios/portfolios.service';
import { ProjectDto, RebalanceDto, RunwayDto } from './dto/analysis.dto';

@Injectable()
export class AnalysisService {
  constructor(private readonly portfolios: PortfoliosService) {}

  async runway(tenantId: string, dto: RunwayDto) {
    const summary = await this.portfolioSummary(tenantId);
    const rateAnnual = dto.rateAnnual ?? 12;
    const rateMonthly = rateAnnual / 100 / 12;
    const burn = dto.monthlyExpense - (dto.monthlyIncome ?? 0);

    let months: number;
    if (burn <= 0) {
      months = Number.POSITIVE_INFINITY;
    } else if (rateMonthly > 0) {
      months = -Math.log(1 - (rateMonthly * summary.totalValue) / burn) / Math.log(1 + rateMonthly);
    } else {
      months = summary.totalValue / burn;
    }

    return {
      assets: summary.totalValue,
      monthlyExpense: dto.monthlyExpense,
      monthlyIncome: dto.monthlyIncome ?? 0,
      burn,
      rateAnnual,
      months: Number.isFinite(months) ? Math.round(months * 10) / 10 : null,
      runwayYears: Number.isFinite(months) ? Math.round((months / 12) * 10) / 10 : null,
      infinite: !Number.isFinite(months),
    };
  }

  project(dto: ProjectDto) {
    const r = dto.rateAnnual / 100 / 12;
    const n = dto.months;
    const futureValue =
      dto.principal * Math.pow(1 + r, n) +
      (dto.monthlyContribution * (Math.pow(1 + r, n) - 1)) / (r || 1e-9);
    const invested = dto.principal + dto.monthlyContribution * n;
    return {
      futureValue,
      invested,
      interest: futureValue - invested,
      months: n,
      rateAnnual: dto.rateAnnual,
    };
  }

  async rebalance(tenantId: string, dto: RebalanceDto) {
    const summary = await this.portfolioSummary(tenantId);
    const allocation = await this.portfolios.allocation(
      tenantId,
      summary.portfolio.id,
    );
    const currentByType = new Map(
      allocation.byType.map((item) => [item.type, item.value]),
    );
    const total = allocation.total;

    const items = Object.entries(dto.target).map(([type, targetPct]) => {
      const currentValue = currentByType.get(type) ?? 0;
      const currentPct = total > 0 ? (currentValue / total) * 100 : 0;
      const targetValue = (targetPct / 100) * total;
      const drift = currentPct - targetPct;
      return {
        type,
        targetPct,
        currentPct: Math.round(currentPct * 100) / 100,
        currentValue,
        targetValue,
        driftPct: Math.round(drift * 100) / 100,
        move: targetValue - currentValue,
      };
    });

    return { total, items };
  }

  private async portfolioSummary(tenantId: string) {
    const portfolio = await this.portfolios.getDefaultPortfolio(tenantId);
    if (!portfolio) {
      return {
        portfolio: { id: '', name: '—', currency: 'BRL' },
        totalValue: 0,
        totalInvested: 0,
      };
    }
    return this.portfolios.summary(tenantId, portfolio.id);
  }
}
