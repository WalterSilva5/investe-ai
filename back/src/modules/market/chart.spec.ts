import { bollinger, chartBreakdown, ema, macd, trendStructure } from './chart';

describe('ema', () => {
  it('primeiro valor = média simples da janela; depois suaviza', () => {
    const values = [10, 11, 12, 13, 14, 15];
    const out = ema(values, 3);
    expect(out[0]).toBeNull();
    expect(out[2]).toBe(11); // média de 10, 11, 12
    expect(out[5]).not.toBeNull();
  });
});

describe('macd', () => {
  it('série em alta = MACD positivo; cruzamento detectado', () => {
    const rising = Array.from({ length: 60 }, (_, i) => 100 + i * 2);
    const m = macd(rising);
    expect(m.macd).not.toBeNull();
    expect(m.macd!).toBeGreaterThan(0);
  });

  it('série curta demais → nulls', () => {
    const m = macd([1, 2, 3]);
    expect(m.macd).toBeNull();
  });
});

describe('bollinger', () => {
  it('preço no meio do canal → percentB ~50', () => {
    const closes = Array.from({ length: 20 }, (_, i) => (i % 2 === 0 ? 100 : 104));
    const b = bollinger(closes);
    expect(b.middle).toBeCloseTo(102, 0);
    expect(b.percentB).not.toBeNull();
  });

  it('preço na alta recente fica perto da banda superior', () => {
    const closes = [...Array.from({ length: 19 }, () => 100), 110];
    const b = bollinger(closes);
    expect(b.percentB!).toBeGreaterThan(90);
  });
});

describe('trendStructure', () => {
  it('topos e fundos crescentes = alta', () => {
    const s = trendStructure([10, 12, 14], [8, 9, 10]);
    expect(s!.pattern).toBe('alta');
  });

  it('decrescentes = baixa', () => {
    const s = trendStructure([14, 12, 10], [12, 11, 9]);
    expect(s!.pattern).toBe('baixa');
  });
});

describe('chartBreakdown', () => {
  it('série com range: separa níveis acima/abaixo e calcula 52 semanas', () => {
    const closes = Array.from({ length: 260 }, (_, i) => 100 + Math.sin(i / 10) * 20 + i * 0.05);
    const breakdown = chartBreakdown(closes);
    expect(breakdown).not.toBeNull();
    expect(breakdown!.price).toBeGreaterThan(0);
    expect(breakdown!.ma200).not.toBeNull();
    expect(breakdown!.high52w!).toBeGreaterThanOrEqual(breakdown!.low52w!);
    // distância ao topo ≥ 0 (quanto falta para voltar) e ao fundo ≤ 0
    expect(breakdown!.fromHigh52wPct!).toBeGreaterThanOrEqual(0);
    expect(breakdown!.fromLow52wPct!).toBeLessThanOrEqual(0);
    expect(breakdown!.bollinger.middle).not.toBeNull();
  });

  it('série curta demais → null', () => {
    expect(chartBreakdown([1, 2, 3])).toBeNull();
  });
});
