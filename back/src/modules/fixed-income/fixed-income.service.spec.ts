import { FixedIncomeService } from './fixed-income.service';

describe('FixedIncomeService', () => {
  const service = new FixedIncomeService();

  it('calcula CDB 100% CDI com IR de 17,5% em 24 meses', () => {
    const result = service.simulate({
      principal: 20000,
      months: 24,
      product: 'CDB',
      rateType: 'CDI_PERCENT',
      rate: 100,
      cdiAnnual: 14,
    });

    expect(result.annualRatePct).toBeCloseTo(14, 5);
    expect(result.gross).toBeCloseTo(5992, 0);
    expect(result.ir).toBeCloseTo(1048.6, 0);
    expect(result.net).toBeCloseTo(4943.4, 0);
    expect(result.irExempt).toBe(false);
  });

  it('isenta LCI de IR', () => {
    const result = service.simulate({
      principal: 20000,
      months: 24,
      product: 'LCI',
      rateType: 'CDI_PERCENT',
      rate: 90,
      cdiAnnual: 14,
    });

    expect(result.ir).toBe(0);
    expect(result.net).toBeCloseTo(result.gross, 6);
    expect(result.irExempt).toBe(true);
  });

  it('calcula Tesouro IPCA+ com inflação', () => {
    const result = service.simulate({
      principal: 20000,
      months: 24,
      product: 'TESOURO',
      rateType: 'IPCA_PLUS',
      rate: 6,
      ipcaAnnual: 5,
    });

    expect(result.annualRatePct).toBeCloseTo(11.3, 5);
    expect(result.net).toBeGreaterThan(0);
    expect(result.net).toBeLessThan(result.gross);
  });

  it('escolhe a melhor opção na comparação', () => {
    const comparison = service.compare([
      {
        principal: 20000,
        months: 24,
        product: 'CDB',
        rateType: 'CDI_PERCENT',
        rate: 100,
        cdiAnnual: 14,
      },
      {
        principal: 20000,
        months: 24,
        product: 'LCI',
        rateType: 'CDI_PERCENT',
        rate: 90,
        cdiAnnual: 14,
      },
    ]);

    expect(comparison.best.product).toBe('LCI');
    expect(comparison.results).toHaveLength(2);
  });
});
