/**
 * Ranking da descoberta: mistura leitura técnica, ganho/risco e histórico do
 * padrão. Determinístico e testável — o "porquê" é montado a partir dos números.
 */

export interface CandidateInput {
  symbol: string;
  technicalScore: number;
  ratio: number | null;
  patternWinRate: number | null;
  patternCompleted: number;
  rsi: number | null;
}

export interface Candidate extends CandidateInput {
  composite: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Converte a relação ganho/risco em nota 0–100 (3:1 já é nota cheia). */
export function ratioScore(ratio: number | null): number {
  if (ratio == null) return 50;
  return clamp(Math.round((ratio / 3) * 100), 0, 100);
}

/** Nota composta: 50% técnica, 30% ganho/risco, 20% histórico do padrão. */
export function compositeScore(input: CandidateInput): number {
  const pattern =
    input.patternCompleted >= 8 && input.patternWinRate != null ? input.patternWinRate : 50;
  const raw = input.technicalScore * 0.5 + ratioScore(input.ratio) * 0.3 + pattern * 0.2;
  // RSI esticado = entrada ruim.
  const rsiPenalty = input.rsi != null && input.rsi > 75 ? 8 : 0;
  // Ganho/risco muito ruim (colado na resistência) pesa mais que a técnica.
  const ratioPenalty = input.ratio != null && input.ratio < 0.5 ? 10 : 0;
  return clamp(Math.round(raw - rsiPenalty - ratioPenalty), 0, 100);
}

/** Ordena candidatos por nota e corta os N melhores. */
export function rankCandidates(inputs: CandidateInput[], limit = 8): Candidate[] {
  return inputs
    .map((input) => ({ ...input, composite: compositeScore(input) }))
    .sort((a, b) => b.composite - a.composite || a.symbol.localeCompare(b.symbol))
    .slice(0, limit);
}

/** Frase curta com os motivos objetivos da nota. */
export function reasonFor(candidate: Candidate): string {
  const parts: string[] = [`técnica ${candidate.technicalScore}/100`];
  if (candidate.ratio != null) parts.push(`ganho/risco ${candidate.ratio.toFixed(2)}:1`);
  if (candidate.patternCompleted >= 8 && candidate.patternWinRate != null) {
    parts.push(`padrão acerta ${candidate.patternWinRate.toFixed(0)}% (${candidate.patternCompleted} casos)`);
  } else {
    parts.push('padrão com amostra pequena');
  }
  if (candidate.rsi != null) parts.push(`RSI ${candidate.rsi.toFixed(0)}`);
  return parts.join(' · ');
}
