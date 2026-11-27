/**
 * Radar contrário: procura papéis que caíram e começam a dar sinal de virada
 * (sobrevenda, suporte próximo, melhora de momentum). Determinístico e
 * testável — descreve sinais, não prevê preço.
 */

export interface ContrarianInput {
  symbol: string;
  /** 0-100 da leitura técnica atual (quanto maior, mais forte). */
  technicalScore: number;
  trend: 'alta' | 'baixa' | 'lateral' | string;
  rsi: number | null;
  ratio: number | null;
  change1d: number | null;
  change1m: number | null;
  change3m: number | null;
  distSupportPct: number | null;
  aboveMa20: boolean;
}

export interface ContrarianResult {
  symbol: string;
  score: number;
  verdict: 'Reversão forte' | 'Reversão em formação' | 'Aguardar' | 'Sem sinal';
  reasons: string[];
}

/**
 * Nota de reversão (0-100). Papel que não caiu ou já está forte não entra:
 * o objetivo é achar queda com sinal de virada, não tendência de alta.
 */
export function contrarianScore(input: ContrarianInput): ContrarianResult {
  const reasons: string[] = [];
  let score = 0;

  const rsi = input.rsi;
  if (rsi != null) {
    if (rsi <= 30) {
      score += 30;
      reasons.push(`RSI ${rsi.toFixed(0)} em sobrevenda`);
    } else if (rsi <= 40) {
      score += 22;
      reasons.push(`RSI ${rsi.toFixed(0)} perto da sobrevenda`);
    } else if (rsi <= 50) {
      score += 12;
      reasons.push(`RSI ${rsi.toFixed(0)} descontado`);
    } else if (rsi <= 60) {
      score += 4;
    }
  }

  if (input.distSupportPct != null) {
    if (input.distSupportPct <= 3) {
      score += 20;
      reasons.push(`a ${input.distSupportPct.toFixed(1)}% do suporte`);
    } else if (input.distSupportPct <= 6) {
      score += 10;
      reasons.push(`a ${input.distSupportPct.toFixed(1)}% do suporte`);
    }
  }

  if (input.ratio != null) {
    if (input.ratio >= 2) {
      score += 20;
      reasons.push(`ganho/risco ${input.ratio.toFixed(2)}:1`);
    } else if (input.ratio >= 1.2) {
      score += 12;
      reasons.push(`ganho/risco ${input.ratio.toFixed(2)}:1`);
    } else if (input.ratio >= 0.8) {
      score += 6;
    }
  }

  if (input.change1d != null && input.change1d > 0) {
    score += 10;
    reasons.push(`repique de ${input.change1d.toFixed(1)}% no dia`);
  }
  if (input.change3m != null && input.change3m <= -10) {
    score += 10;
    reasons.push(`queda de ${input.change3m.toFixed(1)}% em 3 meses`);
  }
  if (
    input.change1m != null &&
    input.change3m != null &&
    input.change1m > input.change3m
  ) {
    score += 8;
    reasons.push('mês melhor que o trimestre (desaceleração da queda)');
  }
  if (input.aboveMa20) {
    score += 8;
    reasons.push('preço recuperou a MM20');
  }

  // Não é contrarian se já está em alta forte ou esticado.
  const strongUp = input.trend === 'alta' && (input.technicalScore >= 65 || (rsi != null && rsi > 60));
  if (strongUp) {
    return { symbol: input.symbol, score: 0, verdict: 'Sem sinal', reasons: ['já está em tendência de alta'] };
  }
  if (input.trend === 'alta' && input.technicalScore >= 65) {
    return { symbol: input.symbol, score: 0, verdict: 'Sem sinal', reasons: ['tendência já forte'] };
  }

  const final = Math.min(100, score);
  const verdict: ContrarianResult['verdict'] =
    final >= 60
      ? 'Reversão forte'
      : final >= 40
        ? 'Reversão em formação'
        : final >= 25
          ? 'Aguardar'
          : 'Sem sinal';
  return { symbol: input.symbol, score: final, verdict, reasons };
}

/** Ordena os candidatos de reversão e corta no limite. */
export function rankContrarian(inputs: ContrarianInput[], limit = 8): ContrarianResult[] {
  return inputs
    .map(contrarianScore)
    .filter((item) => item.score >= 25)
    .sort((a, b) => b.score - a.score || a.symbol.localeCompare(b.symbol))
    .slice(0, limit);
}
