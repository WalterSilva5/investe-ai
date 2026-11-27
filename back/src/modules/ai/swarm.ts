/**
 * Helpers do swarm de auto-ajuste: execução com concorrência limitada
 * (não sobrecarregar o provedor) e agregação dos resultados.
 */

export async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

export interface SwarmOutcome {
  profile: string;
  candidateVersion?: number;
  score?: number;
  baseline?: number | null;
  promoted: boolean;
  reason: string;
  skipped?: string;
}

export interface SwarmSummary {
  total: number;
  promoted: number;
  candidates: number;
  skipped: number;
  best: SwarmOutcome | null;
  byProfile: SwarmOutcome[];
}

/** Agrega os resultados do swarm para o relatório único. */
export function summarizeSwarm(outcomes: SwarmOutcome[]): SwarmSummary {
  const normalized = outcomes.map((outcome) => ({
    ...outcome,
    promoted: Boolean(outcome.promoted),
  }));
  const promoted = normalized.filter((item) => item.promoted);
  const candidates = normalized.filter(
    (item) => !item.promoted && item.candidateVersion != null,
  );
  const skipped = normalized.filter((item) => item.skipped);
  const best = promoted.length
    ? promoted.reduce((a, b) => ((b.score ?? 0) > (a.score ?? 0) ? b : a))
    : null;
  return {
    total: normalized.length,
    promoted: promoted.length,
    candidates: candidates.length,
    skipped: skipped.length,
    best,
    byProfile: normalized,
  };
}
