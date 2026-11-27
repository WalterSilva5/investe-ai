import { edgeLabel, rankSeers, seerScore, summarizeSetups } from './seer';

describe('vidente de dicas (análise geral)', () => {
  const base = {
    setup: 'support',
    setupLabel: 'Teste de suporte',
    completed: 20,
    winRate: 65,
    avgReturn: 2,
    avgReturn20: 3,
    verdict: 'Aguardar',
  };

  it('não pontua com amostra pequena', () => {
    expect(seerScore({ symbol: 'X', ...base, completed: 5 })).toBe(0);
  });

  it('acerto alto com retorno positivo e veredito favorável pontua alto', () => {
    const score = seerScore({ symbol: 'X', ...base, winRate: 70, avgReturn: 4, verdict: 'Oportunidade' });
    expect(score).toBeGreaterThanOrEqual(70);
    expect(edgeLabel(score)).toBe('histórico forte');
  });

  it('veredito de evitar desconta a nota', () => {
    const normal = seerScore({ symbol: 'X', ...base, verdict: 'Aguardar' });
    const avoid = seerScore({ symbol: 'X', ...base, verdict: 'Evitar' });
    expect(avoid).toBeLessThan(normal);
  });

  it('ranking ordena da maior nota e descarta amostra pequena', () => {
    const ranked = rankSeers([
      { symbol: 'A', ...base, winRate: 40 },
      { symbol: 'B', ...base, winRate: 80 },
      { symbol: 'C', ...base, completed: 3 },
    ]);
    expect(ranked[0].symbol).toBe('B');
    expect(ranked.map((r) => r.symbol)).not.toContain('C');
  });

  it('resumo por padrão calcula acerto ponderado e ordena', () => {
    const summary = summarizeSetups([
      { symbol: 'A', ...base, setup: 'support', setupLabel: 'Suporte', winRate: 70, completed: 20 },
      { symbol: 'B', ...base, setup: 'support', setupLabel: 'Suporte', winRate: 50, completed: 20 },
      {
        symbol: 'C',
        ...base,
        setup: 'rsi-oversold',
        setupLabel: 'RSI sobrevenda',
        winRate: 40,
        completed: 20,
      },
    ]);
    expect(summary[0].setup).toBe('support');
    expect(summary[0].weightedWinRate).toBe(60);
    expect(summary[0].assets).toBe(2);
  });
});
