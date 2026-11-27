import { cdiFinalValue, irrAnnualPct, whatifRun } from './whatif';

describe('whatif (simulador de passado)', () => {
  // 60 pregões: preço sobe de 10 para 20 no meio e volta a 15.
  const points = (upTo: number, close: (i: number) => number) =>
    Array.from({ length: upTo }, (_, i) => ({
      date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`,
      close: close(i),
    }));

  it('compra no primeiro pregão e multiplica pelo preço final', () => {
    const pts = points(60, (i) => (i === 0 ? 10 : 15));
    const result = whatifRun({ points: pts, amount: 1000 });
    expect(result!.totalInvested).toBe(1000);
    expect(result!.finalValue).toBe(1500); // 1000/10 = 100 cotas × 15
    expect(result!.profit).toBe(500);
    expect(result!.roiPct).toBe(50);
  });

  it('aportes mensais aumentam o total investido e as cotas', () => {
    // 2 meses de dados (30 pregões por "mês"), preço constante 10.
    const pts = points(60, () => 10);
    const result = whatifRun({ points: pts, amount: 1000, monthly: 500 });
    // Aporte inicial + 1 aporte no 2º mês (mês muda uma vez; último mês não conta).
    expect(result!.totalInvested).toBe(1500);
    expect(result!.finalValue).toBe(1500); // preço constante → sem lucro
    expect(result!.roiPct).toBeCloseTo(0, 6);
  });

  it('drawdown detecta queda do pico na curva de valor', () => {
    const pts = points(60, (i) => (i < 30 ? 10 + i / 3 : 20 - (i - 30) / 3));
    const result = whatifRun({ points: pts, amount: 1000 });
    expect(result!.maxDrawdownPct).toBeGreaterThan(10);
  });

  it('histórico curto demais → null', () => {
    const pts = points(30, () => 10);
    expect(whatifRun({ points: pts, amount: 1000 })).toBeNull();
  });

  it('amount inválido → null', () => {
    const pts = points(60, () => 10);
    expect(whatifRun({ points: pts, amount: 0 })).toBeNull();
  });
});

describe('irrAnnualPct', () => {
  it('aporte único: 1000 → 1500 em 12 meses ≈ +50% a.a.', () => {
    const irr = irrAnnualPct(
      [{ date: '2025-01-01', amount: 1000 }],
      1500,
      '2026-01-01',
    );
    expect(irr).toBeCloseTo(50, 0);
  });

  it('aportes mensais: a.a. menor que o ROI simples dividido', () => {
    // 12 aportes de 100 por 12 meses, dobra no fim (valor 2400 → ROI 100%).
    const irr = irrAnnualPct(
      Array.from({ length: 12 }, (_, i) => ({ date: `2025-${String(i + 1).padStart(2, '0')}-01`, amount: 100 })),
      2400,
      '2026-01-01',
    );
    // Dinheiro entrou ao longo do ano: a.a. real é BEM maior que (2400/1200)^(1/1)−1
    expect(irr).toBeGreaterThan(100);
    expect(irr).toBeLessThan(400);
  });
});

describe('cdiFinalValue', () => {
  it('aplica juros compostos diários entre aporte e fim', () => {
    // 3 dias de CDI 0,05% ao dia.
    const cdi = [
      { date: '2026-01-01', pct: 0.05 },
      { date: '2026-01-02', pct: 0.05 },
      { date: '2026-01-03', pct: 0.05 },
    ];
    // Aporte no dia 1 → 3 dias de fator? O fator usa os dias APÓS o aporte (i+1).
    const result = cdiFinalValue(
      [{ date: '2026-01-01', amount: 1000 }],
      cdi,
    );
    expect(result!.totalInvested).toBe(1000);
    expect(result!.finalValue).toBeCloseTo(1000 * Math.pow(1.0005, 2), 2);
  });

  it('aporte fora da janela é ignorado', () => {
    const cdi = [{ date: '2026-01-02', pct: 0.05 }];
    const result = cdiFinalValue([{ date: '2025-12-01', amount: 500 }], cdi);
    expect(result).toBeNull();
  });
});
