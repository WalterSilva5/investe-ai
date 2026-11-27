import { contrarianScore, rankContrarian } from './contrarian';

describe('contrarian radar', () => {
  const base = {
    technicalScore: 30,
    trend: 'baixa',
    rsi: 28,
    ratio: 2.5,
    change1d: 2,
    change1m: -3,
    change3m: -20,
    distSupportPct: 2,
    aboveMa20: false,
  };

  it('queda com sobrevenda, suporte perto e ganho/risco alto vira reversão forte', () => {
    const result = contrarianScore({ symbol: 'X', ...base });
    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(result.verdict).toBe('Reversão forte');
    expect(result.reasons.length).toBeGreaterThan(2);
  });

  it('papel já em alta forte não entra no radar contrário', () => {
    const result = contrarianScore({
      symbol: 'X',
      ...base,
      trend: 'alta',
      technicalScore: 85,
      rsi: 70,
    });
    expect(result.score).toBe(0);
    expect(result.verdict).toBe('Sem sinal');
  });

  it('sem sinais de virada fica sem sinal', () => {
    const result = contrarianScore({
      symbol: 'X',
      technicalScore: 45,
      trend: 'lateral',
      rsi: 58,
      ratio: 0.4,
      change1d: -1,
      change1m: -12,
      change3m: -8,
      distSupportPct: 9,
      aboveMa20: false,
    });
    expect(result.score).toBeLessThan(25);
    expect(result.verdict).toBe('Sem sinal');
  });

  it('ranking descarta notas baixas e ordena da maior para a menor', () => {
    const ranked = rankContrarian([
      { symbol: 'A', ...base, rsi: 55, ratio: 0.5, distSupportPct: 12, change3m: -2 },
      { symbol: 'B', ...base },
      { symbol: 'C', ...base, rsi: 35, ratio: 1.3, distSupportPct: 5, change3m: -12 },
    ]);
    expect(ranked[0].symbol).toBe('B');
    expect(ranked.every((item) => item.score >= 25)).toBe(true);
    expect(ranked.map((r) => r.symbol)).not.toContain('A');
  });
});
