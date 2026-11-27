import { compositeScore, rankCandidates, ratioScore, reasonFor } from './ranking';

describe('discovery ranking', () => {
  const base = {
    technicalScore: 60,
    ratio: 1.5,
    patternWinRate: 60,
    patternCompleted: 10,
    rsi: 55,
  };

  it('relação ganho/risco vira nota de 0 a 100', () => {
    expect(ratioScore(null)).toBe(50);
    expect(ratioScore(0)).toBe(0);
    expect(ratioScore(3)).toBe(100);
    expect(ratioScore(6)).toBe(100);
  });

  it('combina técnica, ganho/risco e histórico do padrão', () => {
    const score = compositeScore({ symbol: 'X', ...base });
    expect(score).toBeGreaterThan(50);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('RSI esticado reduz a nota', () => {
    const normal = compositeScore({ symbol: 'X', ...base });
    const stretched = compositeScore({ symbol: 'X', ...base, rsi: 80 });
    expect(stretched).toBeLessThan(normal);
  });

  it('amostra pequena de padrão não distorce a nota', () => {
    const withSample = compositeScore({ symbol: 'X', ...base, patternWinRate: 95, patternCompleted: 12 });
    const tiny = compositeScore({ symbol: 'X', ...base, patternWinRate: 95, patternCompleted: 2 });
    expect(tiny).toBeLessThan(withSample);
  });

  it('ganho/risco ruim derruba a nota mesmo com técnica alta', () => {
    const good = compositeScore({ symbol: 'X', ...base, ratio: 2.5 });
    const bad = compositeScore({ symbol: 'X', ...base, ratio: 0.1 });
    expect(bad).toBeLessThan(good - 20);
  });

  it('ordena do maior para o menor e corta no limite', () => {
    const ranked = rankCandidates(
      [
        { symbol: 'A', ...base, technicalScore: 40 },
        { symbol: 'B', ...base, technicalScore: 90 },
        { symbol: 'C', ...base, technicalScore: 70 },
      ],
      2,
    );
    expect(ranked).toHaveLength(2);
    expect(ranked[0].symbol).toBe('B');
    expect(ranked[1].symbol).toBe('C');
  });

  it('o motivo cita números concretos', () => {
    const ranked = rankCandidates([{ symbol: 'PETR4', ...base }], 1);
    const reason = reasonFor(ranked[0]);
    expect(reason).toContain('técnica 60/100');
    expect(reason).toContain('ganho/risco 1.50:1');
    expect(reason).toContain('padrão acerta 60%');
  });

  it('declara amostra pequena em vez de inventar acerto', () => {
    const ranked = rankCandidates(
      [{ symbol: 'X', ...base, patternWinRate: 90, patternCompleted: 3 }],
      1,
    );
    expect(reasonFor(ranked[0])).toContain('amostra pequena');
  });
});
