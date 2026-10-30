import { AnalysisService } from './analysis.service';

describe('AnalysisService', () => {
  const service = new AnalysisService({} as never);

  it('projeta valor futuro com aportes', () => {
    const result = service.project({
      principal: 20000,
      monthlyContribution: 2500,
      rateAnnual: 14,
      months: 24,
    });

    expect(result.invested).toBe(80000);
    expect(result.futureValue).toBeGreaterThan(result.invested);
    expect(result.interest).toBeCloseTo(result.futureValue - result.invested, 2);
  });

  it('sem aporte e sem juros mantém o principal', () => {
    const result = service.project({
      principal: 10000,
      monthlyContribution: 0,
      rateAnnual: 0,
      months: 12,
    });

    expect(result.futureValue).toBeCloseTo(10000, 6);
  });
});
