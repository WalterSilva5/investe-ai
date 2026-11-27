import { runWithConcurrency, summarizeSwarm, SwarmOutcome } from './swarm';

describe('swarm de auto-ajuste', () => {
  it('roda com concorrência limitada e mantém a ordem', async () => {
    const started: number[] = [];
    const results = await runWithConcurrency([1, 2, 3, 4, 5], 2, async (item) => {
      started.push(item);
      return item * 10;
    });
    expect(results).toEqual([10, 20, 30, 40, 50]);
    expect(started.length).toBe(5);
  });

  it('não deixa de rodar item se a lista for menor que o limite', async () => {
    const results = await runWithConcurrency(['a'], 4, async (item) => item.toUpperCase());
    expect(results).toEqual(['A']);
  });

  it('agrega o relatório do swarm', () => {
    const outcomes: SwarmOutcome[] = [
      { profile: 'geral', candidateVersion: 2, score: 100, baseline: 98, promoted: true, reason: 'margem' },
      { profile: 'macro', candidateVersion: 2, score: 90, baseline: 98, promoted: false, reason: 'sem margem' },
      { profile: 'cripto', promoted: false, reason: 'rascunho vazio', skipped: 'rascunho vazio' },
    ];
    const summary = summarizeSwarm(outcomes);
    expect(summary.total).toBe(3);
    expect(summary.promoted).toBe(1);
    expect(summary.candidates).toBe(1);
    expect(summary.skipped).toBe(1);
    expect(summary.best?.profile).toBe('geral');
  });
});
