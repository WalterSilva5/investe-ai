import { halvingContext } from './halving';

describe('halving cycle', () => {
  it('em nov/2026 fica a ~500 dias do próximo halving e na fase pré-halving', () => {
    const ctx = halvingContext(new Date('2026-11-27T12:00:00Z'));
    expect(ctx.daysBeforeNext).toBeGreaterThan(450);
    expect(ctx.daysBeforeNext).toBeLessThan(560);
    expect(ctx.nextHalving.estimated).toBe(true);
    expect(ctx.phase).toContain('Pré-halving');
    expect(ctx.lastHalving.date).toBe('2024-04-19');
  });

  it('logo após o halving de 2020 fica em pós-halving imediato', () => {
    const ctx = halvingContext(new Date('2020-06-01T00:00:00Z'));
    expect(ctx.phase).toBe('Pós-halving imediato');
    expect(ctx.lastHalving.daysAgo).toBeLessThan(60);
  });

  it('no fim de 2021 fica na fase de topo histórico', () => {
    const ctx = halvingContext(new Date('2021-11-01T00:00:00Z'));
    expect(ctx.phase.toLowerCase()).toContain('topo');
  });

  it('a referência histórica dos ciclos vem preenchida', () => {
    const ctx = halvingContext(new Date('2026-11-27T00:00:00Z'));
    expect(ctx.reference.length).toBeGreaterThanOrEqual(3);
    expect(ctx.reference[0].daysHalvingToTop).toBeGreaterThan(0);
  });
});
