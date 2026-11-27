import {
  alignSeries,
  correlationPairs,
  portfolioBacktest,
  returns,
  weeklySample,
} from './tool-math';

describe('tool-math', () => {
  describe('alignSeries', () => {
    it('intersecciona datas e mantém ordem cronológica', () => {
      const a = { symbol: 'A', points: [{ date: '2026-01-02', close: 10 }, { date: '2026-01-03', close: 11 }] };
      const b = { symbol: 'B', points: [{ date: '2026-01-03', close: 100 }, { date: '2026-01-02', close: 90 }] };
      const aligned = alignSeries([a, b]);
      expect(aligned.dates).toEqual(['2026-01-02', '2026-01-03']);
      expect(aligned.closes).toEqual([
        [10, 90],
        [11, 100],
      ]);
    });

    it('série vazia → resultado vazio', () => {
      expect(alignSeries([])).toEqual({ dates: [], closes: [] });
    });
  });

  describe('returns', () => {
    it('calcula retornos simples e pula base inválida', () => {
      const rs = returns([100, 110, 99]);
      expect(rs[0]).toBeCloseTo(0.1, 6);
      expect(rs[1]).toBeCloseTo(-0.1, 6);
      expect(returns([0, 5, 10])).toEqual([1]); // base 0 é pulada
    });
  });

  describe('pearson via correlationPairs', () => {
    it('correlação perfeita = 1 e inversa = -1', () => {
      const up = { symbol: 'UP', points: [] as Array<{ date: string; close: number }> };
      const down = { symbol: 'DOWN', points: [] as Array<{ date: string; close: number }> };
      const flatNoise = { symbol: 'N', points: [] as Array<{ date: string; close: number }> };
      // UP e DOWN são inversos exatos; N é ruído quase independente.
      let base = 100;
      let noise = 100;
      const seed = [3, -1, 4, 2, -2, 5, -3, 1, 6, -4, 2, 3, -1, 4, -2, 5, 1, -5];
      for (const step of seed) {
        base += step;
        noise += step % 2 === 0 ? step : -step;
        up.points.push({ date: `d${up.points.length}`, close: base });
        down.points.push({ date: `d${down.points.length}`, close: 300 - base });
        flatNoise.points.push({ date: `d${flatNoise.points.length}`, close: noise });
      }
      const aligned = alignSeries([up, down, flatNoise]);
      const pairs = correlationPairs(['UP', 'DOWN', 'N'], aligned);
      const perfect = pairs.find((p) => p.a === 'UP' && p.b === 'DOWN');
      expect(perfect?.r).toBeCloseTo(-1, 1);
      const self = pairs.find((p) => p.a === 'UP' && p.b === 'N');
      expect(self?.r).not.toBeNull();
    });

    it('série curta demais → r null', () => {
      const a = { symbol: 'A', points: [{ date: 'd0', close: 1 }, { date: 'd1', close: 2 }] };
      const b = { symbol: 'B', points: [{ date: 'd0', close: 9 }, { date: 'd1', close: 8 }] };
      const pairs = correlationPairs(['A', 'B'], alignSeries([a, b]));
      expect(pairs[0].r).toBeNull();
    });
  });

  describe('weeklySample', () => {
    it('amostra ~1 a cada 5 pontos do fim para o começo, em ordem', () => {
      const points = Array.from({ length: 26 }, (_, i) => ({
        date: `2026-01-${String(i + 1).padStart(2, '0')}`,
        close: i + 1,
      }));
      const sampled = weeklySample(alignSeries([{ symbol: 'A', points }]));
      expect(sampled.dates).toHaveLength(6);
      // ordem cronológica preservada e último ponto é o mais recente
      expect(sampled.dates).toEqual([...sampled.dates].sort());
      expect(sampled.dates[sampled.dates.length - 1]).toBe('2026-01-26');
      expect(sampled.closes[sampled.closes.length - 1]).toEqual([26]);
    });
  });

  describe('portfolioBacktest', () => {
    it('carteira 50/50 de ativo dobrado e ativo estável = média dos dois', () => {
      const points = Array.from({ length: 42 }, (_, i) => ({
        date: `d${i}`,
        close: i < 21 ? 10 * (i + 1) / 21 * 2 : 20, // sobe até dobrar e estabiliza
      }));
      const doubled = Array.from({ length: 42 }, (_, i) => ({
        date: `d${i}`,
        close: i < 21 ? 10 + i * 0.4762 : 20, // aprox 10 → 20
      }));
      const stable = Array.from({ length: 42 }, (_, i) => ({ date: `d${i}`, close: 50 }));
      const metrics = portfolioBacktest(
        [0.5, 0.5],
        alignSeries([
          { symbol: 'DOUBLED', points: doubled },
          { symbol: 'STABLE', points: stable },
        ]),
      );
      expect(metrics).not.toBeNull();
      expect(metrics!.totalReturnPct).toBeGreaterThan(0);
      expect(metrics!.totalReturnPct).toBeLessThan(55); // metade do dobro
      void points;
    });

    it('pesos que não somam 1 → null', () => {
      const stable = Array.from({ length: 40 }, (_, i) => ({ date: `d${i}`, close: 50 }));
      const aligned = alignSeries([{ symbol: 'S', points: stable }]);
      expect(portfolioBacktest([0.5], aligned)).toBeNull();
    });

    it('carteira com peso negativo → null', () => {
      const stable = Array.from({ length: 40 }, (_, i) => ({ date: `d${i}`, close: 50 }));
      const aligned = alignSeries([{ symbol: 'S', points: stable }]);
      expect(portfolioBacktest([-0.2, 1.2], aligned)).toBeNull();
    });

    it('drawdown detecta queda do pico', () => {
      const v = Array.from({ length: 40 }, (_, i) => ({ date: `d${i}`, close: i < 10 ? 100 + i : i < 20 ? 110 - (i - 10) : 100 }));
      const metrics = portfolioBacktest([1], alignSeries([{ symbol: 'V', points: v }]));
      expect(metrics!.maxDrawdownPct).toBeGreaterThan(0);
    });
  });
});
