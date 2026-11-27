/**
 * Termômetro do tema: separa "força do setor" (atenção, tendência, estágio)
 * da "leitura" de momento (bullish/bearish/neutro). Educacional: divergência
 * entre setor forte e leitura fraca pede cautela com o tema — nunca é
 * recomendação de compra/venda.
 */

export type ThermometerReading = 'Bullish' | 'Neutro' | 'Bearish';

export interface Thermometer {
  /** 0-100. */
  score: number;
  label: 'Forte' | 'Neutro' | 'Fraco';
  reading: ThermometerReading;
  /** Dica curta e direta do que fazer com o tema agora. */
  tip: string;
}

const STAGE_DELTA: Record<string, number> = {
  EMERGENTE: 10,
  HYPE: -10,
  DESILUSAO: -15,
  MATURACAO: 10,
  PLATEAU: 0,
  DECLINIO: -15,
};

export function buildThermometer(input: {
  attention?: number;
  trend?: number;
  stage?: string | null;
  hypeRisk?: number | null;
}): Thermometer {
  const attention = Math.max(0, input.attention ?? 0);
  const trend = input.trend ?? 0;
  const stage = (input.stage || '').toUpperCase();
  const hype = Math.min(100, Math.max(0, input.hypeRisk ?? 0));

  const score = Math.min(
    100,
    Math.max(
      0,
      Math.round(50 + (STAGE_DELTA[stage] ?? 0) + trend * 4 + Math.min(attention, 10) * 0.5 - hype * 0.25),
    ),
  );
  const label = score >= 70 ? 'Forte' : score >= 40 ? 'Neutro' : 'Fraco';

  // Estágio (quando há análise) tem prioridade; sem análise, a tendência manda.
  let reading: ThermometerReading = 'Neutro';
  if (stage) {
    if (stage === 'HYPE' || stage === 'DECLINIO' || stage === 'DESILUSAO') {
      reading = 'Bearish';
    } else if (trend >= 3 || stage === 'EMERGENTE') {
      reading = 'Bullish';
    } else if (trend <= -3) {
      reading = 'Bearish';
    }
  } else if (trend >= 2) {
    reading = 'Bullish';
  } else if (trend <= -2) {
    reading = 'Bearish';
  }

  return { score, label, reading, tip: tipFor(label, reading) };
}

/** Frase curta e acionável (observação, não ordem) para o card do radar. */
function tipFor(label: Thermometer['label'], reading: ThermometerReading): string {
  if (reading === 'Bullish' && label === 'Forte') {
    return 'Atenção e tendência a favor: momento de acompanhar de perto, com gatilho definido antes de agir.';
  }
  if (reading === 'Bullish') {
    return 'Sinal de melhora, mas ainda sem força: observe a confirmação antes de dar peso.';
  }
  if (reading === 'Bearish' && label !== 'Fraco') {
    return 'Setor aquecido com leitura virando: risco de topo — prefira esperar e rever a tese.';
  }
  if (reading === 'Bearish') {
    return 'Momento fraco: melhor aguardar sinal de virada do que antecipar.';
  }
  return 'Sem sinal claro: aguarde definição (tendência ou atenção) para agir.';
}
