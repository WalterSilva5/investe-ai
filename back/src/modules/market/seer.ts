/**
 * "Vidente de dicas": ranqueia oportunidades do universo pelo histórico do
 * padrão que o papel vive AGORA. Não prevê preço — mede quantas vezes aquele
 * padrão funcionou no próprio papel e combina com o veredito atual.
 */

export interface SeerCandidate {
  symbol: string;
  setup: string;
  setupLabel: string;
  completed: number;
  winRate: number | null;
  avgReturn: number | null;
  avgReturn20: number | null;
  verdict: 'Oportunidade' | 'Aguardar' | 'Evitar' | string;
}

export interface SeerRanked extends SeerCandidate {
  score: number;
  edge: string;
}

const MIN_CASES = 8;

/** Nota 0–100: acerto suavizado + retorno médio + ajuste pelo veredito. */
export function seerScore(candidate: SeerCandidate): number {
  if (candidate.completed < MIN_CASES || candidate.winRate == null) return 0;
  const wins = Math.round((candidate.winRate / 100) * candidate.completed);
  // Laplace: evita 100% com 8 casos; puxa para 50% quando a amostra é curta.
  const smoothed = ((wins + 1) / (candidate.completed + 2)) * 100;
  const returnBonus = Math.max(-15, Math.min(15, (candidate.avgReturn ?? 0) * 3));
  const verdictBonus =
    candidate.verdict === 'Oportunidade' ? 10 : candidate.verdict === 'Evitar' ? -15 : 0;
  return Math.max(0, Math.min(100, Math.round(smoothed + returnBonus + verdictBonus)));
}

/** Ordena por nota e corta no limite, descartando amostra pequena. */
export function rankSeers(candidates: SeerCandidate[], limit = 10): SeerRanked[] {
  return candidates
    .filter((candidate) => candidate.completed >= MIN_CASES)
    .map((candidate) => ({
      ...candidate,
      score: seerScore(candidate),
      edge: edgeLabel(seerScore(candidate)),
    }))
    .sort((a, b) => b.score - a.score || a.symbol.localeCompare(b.symbol))
    .slice(0, limit);
}

export function edgeLabel(score: number): string {
  if (score >= 70) return 'histórico forte';
  if (score >= 55) return 'histórico aproveitável';
  if (score >= 40) return 'histórico fraco';
  return 'sem vantagem';
}

export interface SetupSummary {
  setup: string;
  setupLabel: string;
  assets: number;
  weightedWinRate: number | null;
  avgReturn: number | null;
  avgReturn20: number | null;
}

/** Resumo por padrão no universo: qual tem funcionado melhor. */
export function summarizeSetups(candidates: SeerCandidate[]): SetupSummary[] {
  const acc = new Map<string, { label: string; wins: number; total: number; ret: number[]; ret20: number[]; assets: number }>();
  for (const candidate of candidates) {
    if (candidate.completed < MIN_CASES || candidate.winRate == null) continue;
    const entry =
      acc.get(candidate.setup) || { label: candidate.setupLabel, wins: 0, total: 0, ret: [], ret20: [], assets: 0 };
    entry.wins += Math.round((candidate.winRate / 100) * candidate.completed);
    entry.total += candidate.completed;
    if (candidate.avgReturn != null) entry.ret.push(candidate.avgReturn);
    if (candidate.avgReturn20 != null) entry.ret20.push(candidate.avgReturn20);
    entry.assets += 1;
    acc.set(candidate.setup, entry);
  }
  return [...acc.entries()]
    .map(([setup, entry]) => ({
      setup,
      setupLabel: entry.label,
      assets: entry.assets,
      weightedWinRate: entry.total ? round((entry.wins / entry.total) * 100) : null,
      avgReturn: entry.ret.length ? round(avg(entry.ret)) : null,
      avgReturn20: entry.ret20.length ? round(avg(entry.ret20)) : null,
    }))
    .sort((a, b) => (b.weightedWinRate ?? 0) - (a.weightedWinRate ?? 0));
}

function avg(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
