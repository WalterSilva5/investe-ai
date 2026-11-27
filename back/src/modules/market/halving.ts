/**
 * Ciclo do halving do Bitcoin. Datas e preços históricos aproximados (fato
 * público de mercado); a próxima data é ESTIMADA (210 mil blocos ≈ 4 anos).
 * Serve como contexto de ciclo — não é previsão do próximo topo ou fundo.
 */

export interface Halving {
  date: string;
  priceUsdApprox: number | null;
  estimated?: boolean;
}

export const HALVINGS: Halving[] = [
  { date: '2012-11-28', priceUsdApprox: 12 },
  { date: '2016-07-09', priceUsdApprox: 650 },
  { date: '2020-05-11', priceUsdApprox: 8600 },
  { date: '2024-04-19', priceUsdApprox: 64000 },
  { date: '2028-04-15', priceUsdApprox: null, estimated: true },
];

/** Referência histórica dos ciclos (valores aproximados e arredondados). */
export const CYCLE_REFERENCE = [
  {
    halving: '2012-11-28',
    priceAtHalvingUsd: 12,
    topUsdApprox: 1150,
    daysHalvingToTop: 380,
    followingDrawdownPct: -85,
  },
  {
    halving: '2016-07-09',
    priceAtHalvingUsd: 650,
    topUsdApprox: 19800,
    daysHalvingToTop: 520,
    followingDrawdownPct: -84,
  },
  {
    halving: '2020-05-11',
    priceAtHalvingUsd: 8600,
    topUsdApprox: 69000,
    daysHalvingToTop: 550,
    followingDrawdownPct: -77,
  },
  {
    halving: '2024-04-19',
    priceAtHalvingUsd: 64000,
    topUsdApprox: null,
    daysHalvingToTop: null,
    followingDrawdownPct: null,
  },
];

export interface HalvingContext {
  lastHalving: { date: string; daysAgo: number };
  nextHalving: { date: string; daysAhead: number; estimated: boolean };
  /** Dias até o próximo halving (o número que o usuário costuma citar). */
  daysBeforeNext: number;
  phase: string;
  phaseNote: string;
  reference: typeof CYCLE_REFERENCE;
}

const DAY = 86_400_000;

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / DAY);
}

/** Contexto de ciclo na data informada (default: agora). */
export function halvingContext(now: Date = new Date()): HalvingContext {
  const sorted = [...HALVINGS].sort((a, b) => a.date.localeCompare(b.date));
  const past = sorted.filter((h) => new Date(`${h.date}T00:00:00Z`) <= now);
  const future = sorted.filter((h) => new Date(`${h.date}T00:00:00Z`) > now);
  const last = past[past.length - 1] ?? sorted[0];
  const next = future[0] ?? sorted[sorted.length - 1];

  const lastDate = new Date(`${last.date}T00:00:00Z`);
  const nextDate = new Date(`${next.date}T00:00:00Z`);
  const daysAgo = daysBetween(lastDate, now);
  const daysAhead = daysBetween(now, nextDate);

  let phase: string;
  let phaseNote: string;
  if (daysAhead <= 600) {
    phase = 'Pré-halving (zona histórica de acumulação)';
    phaseNote =
      `Faltam ~${daysAhead} dias para o próximo halving (estimado). Nos ciclos de 2016, 2020 e 2024, ` +
      'os fundos aconteceram cerca de 500 dias antes do halving — não é garantia, é padrão observado.';
  } else if (daysAgo < 180) {
    phase = 'Pós-halving imediato';
    phaseNote = `~${daysAgo} dias após o halving: oferta nova caiu, mercado ainda digerindo.`;
  } else if (daysAgo < 380) {
    phase = 'Expansão inicial';
    phaseNote = `~${daysAgo} dias após o halving: fase de expansão do ciclo.`;
  } else if (daysAgo < 560) {
    phase = 'Bull run / topo histórico';
    phaseNote = `~${daysAgo} dias após o halving: nos ciclos anteriores o topo veio entre 380 e 550 dias.`;
  } else if (daysAgo < 800) {
    phase = 'Distribuição / correção inicial';
    phaseNote = `~${daysAgo} dias após o halving: depois do topo histórico, a fase costuma ser de correção.`;
  } else {
    phase = 'Bear / desilusão';
    phaseNote = `~${daysAgo} dias após o halving: fase de correção profunda nos ciclos anteriores.`;
  }

  return {
    lastHalving: { date: last.date, daysAgo },
    nextHalving: { date: next.date, daysAhead, estimated: Boolean(next.estimated) },
    daysBeforeNext: daysAhead,
    phase,
    phaseNote,
    reference: CYCLE_REFERENCE,
  };
}
