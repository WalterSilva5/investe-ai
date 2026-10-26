import { Injectable } from '@nestjs/common';
import { SimulateFixedIncomeDto } from './dto/simulate.dto';

export interface SimulationResult {
  product: string;
  rateType: string;
  rate: number;
  annualRatePct: number;
  months: number;
  principal: number;
  gross: number;
  ir: number;
  iof: number;
  net: number;
  netAnnualPct: number;
  netMonthlyPct: number;
  irExempt: boolean;
}

@Injectable()
export class FixedIncomeService {
  simulate(dto: SimulateFixedIncomeDto): SimulationResult {
    const annualRate = this.effectiveAnnualRate(dto);
    const months = dto.months;
    const gross = dto.principal * (Math.pow(1 + annualRate, months / 12) - 1);
    const irExempt = dto.product === 'LCI' || dto.product === 'LCA';
    const ir = irExempt ? 0 : gross * this.irRate(months);
    const iof = 0; // meses >= 1: IOF zerado
    const net = gross - ir - iof;
    const netAnnual = Math.pow(1 + net / dto.principal, 12 / months) - 1;
    const netMonthly = Math.pow(1 + annualRate, 1 / 12) - 1;

    return {
      product: dto.product,
      rateType: dto.rateType,
      rate: dto.rate,
      annualRatePct: annualRate * 100,
      months,
      principal: dto.principal,
      gross,
      ir,
      iof,
      net,
      netAnnualPct: netAnnual * 100,
      netMonthlyPct: netMonthly * 100,
      irExempt,
    };
  }

  compare(items: SimulateFixedIncomeDto[]) {
    const results = items.map((item) => this.simulate(item));
    const best = results.reduce((a, b) => (b.net > a.net ? b : a), results[0]);
    return { results, best };
  }

  private effectiveAnnualRate(dto: SimulateFixedIncomeDto): number {
    if (dto.rateType === 'PREFIXED') {
      return dto.rate / 100;
    }
    if (dto.rateType === 'CDI_PERCENT') {
      const cdi = (dto.cdiAnnual ?? 14) / 100;
      return cdi * (dto.rate / 100);
    }
    const ipca = (dto.ipcaAnnual ?? 5) / 100;
    return (1 + ipca) * (1 + dto.rate / 100) - 1;
  }

  private irRate(months: number): number {
    if (months <= 6) return 0.225;
    if (months <= 12) return 0.2;
    if (months <= 24) return 0.175;
    return 0.15;
  }
}
