import {
  annualizedVolatility,
  changePct,
  levelsAround,
  movingAverage,
  rsi,
  setupStats,
  technicalReading,
} from './indicators';

/** Série determinística de teste (sem aleatoriedade, para o teste ser estável). */
function series(prices: number[]): number[] {
  return prices;
}

describe('indicators', () => {
  it('média móvel usa as últimas N barras', () => {
    expect(movingAverage([1, 2, 3, 4, 5], 3)).toBe(4);
    expect(movingAverage([1, 2], 5)).toBeNull();
  });

  it('RSI é 100 numa série que só sobe e 0 numa que só cai', () => {
    const up = series(Array.from({ length: 30 }, (_, i) => 100 + i));
    const down = series(Array.from({ length: 30 }, (_, i) => 100 - i * 0.5));
    expect(rsi(up)).toBe(100);
    expect(rsi(down)).toBeLessThan(5);
  });

  it('RSI fica no meio (30..70) numa série alternada', () => {
    const zigzag = series(
      Array.from({ length: 40 }, (_, i) => 100 + (i % 2 === 0 ? 2 : -2)),
    );
    const value = rsi(zigzag);
    expect(value).not.toBeNull();
    expect(value!).toBeGreaterThan(20);
    expect(value!).toBeLessThan(80);
  });

  it('variação percentual compara com N barras atrás', () => {
    expect(changePct([100, 105, 110], 2)).toBe(10);
    expect(changePct([100], 1)).toBeNull();
  });

  it('volatilidade é nula com poucos dados e positiva numa série oscilante', () => {
    expect(annualizedVolatility([1, 2, 3])).toBeNull();
    const wave = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i) * 5);
    expect(annualizedVolatility(wave)!).toBeGreaterThan(0);
  });

  it('suportes ficam abaixo e resistências acima do preço atual', () => {
    const closes = [
      100, 108, 104, 96, 92, 98, 106, 112, 104, 96, 94, 100, 108, 114, 106, 98, 95, 101, 109, 115,
    ];
    const { supports, resistances } = levelsAround(closes, 3, 0.02, 2);
    const current = closes[closes.length - 1];
    supports.forEach((s) => expect(s).toBeLessThan(current));
    resistances.forEach((r) => expect(r).toBeGreaterThan(current));
  });

  it('backtest do padrão conta acertos e calcula retorno médio', () => {
    // sobe 1%, depois cai até testar suporte, depois recupera
    const closes: number[] = [];
    for (let i = 0; i < 60; i += 1) {
      closes.push(100 + Math.sin(i / 4) * 10 + i * 0.3);
    }
    const stats = setupStats(closes, 'support', 5);
    expect(stats.setup).toBe('support');
    expect(stats.horizon).toBe(5);
    expect(stats.occurrences).toBeGreaterThan(0);
    expect(stats.completed).toBeLessThanOrEqual(stats.occurrences);
    if (stats.completed > 0) {
      expect(stats.winRate).toBeGreaterThanOrEqual(0);
      expect(stats.winRate).toBeLessThanOrEqual(100);
      expect(stats.avgReturn).not.toBeNull();
    }
  });

  it('padrão sem histórico não inventa estatística', () => {
    const flat = Array.from({ length: 40 }, () => 100);
    const stats = setupStats(flat, 'ma50-cross', 10);
    expect(stats.occurrences).toBe(0);
    expect(stats.winRate).toBeNull();
    expect(stats.avgReturn).toBeNull();
  });

  describe('leitura técnica (resumo e ganho/risco)', () => {
    const uptrend = Array.from({ length: 120 }, (_, i) => 50 + i * 0.5);

    it('série em alta com médias alinhadas vira tendência de alta e score favorável', () => {
      const read = technicalReading(uptrend, { supports: [100], resistances: [115] });
      expect(read.trend).toBe('alta');
      expect(read.score).toBeGreaterThanOrEqual(65);
      expect(read.label).toBe('Favorável');
    });

    it('ganho/risco usa resistência como alvo e suporte como piso', () => {
      const closes = Array.from({ length: 120 }, () => 100);
      const read = technicalReading(closes, { supports: [95], resistances: [110] });
      expect(read.upsidePct).toBeCloseTo(10, 1);
      expect(read.downsidePct).toBeCloseTo(5, 1);
      expect(read.ratio).toBeCloseTo(2, 1);
    });

    it('sem resistência ou suporte não inventa relação', () => {
      const closes = Array.from({ length: 120 }, () => 100);
      const read = technicalReading(closes, { supports: [], resistances: [] });
      expect(read.upsidePct).toBeNull();
      expect(read.downsidePct).toBeNull();
      expect(read.ratio).toBeNull();
    });
  });
});
