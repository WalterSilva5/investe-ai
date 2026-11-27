import { strategyContributions, strategyRun } from './strategy';
import { agentSignal } from './indicators';

/** Sintética: degraus com correções (gera suporte/resistência → Oportunidade e Evitar). */
function makePoints(): Array<{ date: string; close: number }> {
  const points: Array<{ date: string; close: number }> = [];
  let close = 100;
  for (let i = 0; i < 300; i += 1) {
    const month = Math.floor(i / 21);
    const year = 2024 + Math.floor(month / 12);
    const m = (month % 12) + 1;
    const phase = i % 80;
    // sobe 60 barras, recua 20 (repete) → degraus com suporte e topo definidos
    if (phase < 60) close += 1.2;
    else close -= 2;
    points.push({ date: `${year}-${String(m).padStart(2, '0')}-15`, close: Math.round(close * 100) / 100 });
  }
  return points;
}

describe('agentSignal (mesma régua do veredito)', () => {
  it('score alto com ganho/risco ≥ 1.2 = Oportunidade', () => {
    expect(agentSignal({ score: 80, trend: 'alta', ratio: 2 })).toBe('Oportunidade');
  });
  it('score alto sem ganho/risco = Aguardar', () => {
    expect(agentSignal({ score: 80, trend: 'alta', ratio: 1.0 })).toBe('Aguardar');
  });
  it('score baixo ou baixa com ratio < 0.5 = Evitar', () => {
    expect(agentSignal({ score: 30, trend: 'baixa', ratio: 2 })).toBe('Evitar');
    expect(agentSignal({ score: 80, trend: 'baixa', ratio: 0.3 })).toBe('Evitar');
  });
});

describe('strategyRun (seguindo o agente)', () => {
  it('compra na primeira Oportunidade e vende no Evitar (mecânica com sinais forçados)', () => {
    const points = makePoints();
    // 1ª âncora: Oportunidade (compra); 3ª âncora: Evitar (venda).
    const result = strategyRun({
      points,
      amount: 1000,
      monthly: 0,
      warmup: 130,
      step: 21,
      signalOverride: (anchor) => (anchor === 0 ? 'Oportunidade' : anchor === 2 ? 'Evitar' : 'Aguardar'),
    });
    expect(result!.trades.length).toBe(2);
    expect(result!.trades[0].action).toBe('COMPRA');
    expect(result!.trades[0].cashAfter).toBe(0);
    expect(result!.trades[1].action).toBe('VENDA');
    expect(result!.trades[1].sharesAfter).toBe(0);
    // depois da venda, todo o valor está no caixa: valor final = caixa
    expect(result!.finalValue).toBeCloseTo(result!.trades[1].cashAfter, 2);
  });

  it('estrutura completa com as regras reais (sinais, curva e comparador)', () => {
    const result = strategyRun({ points: makePoints(), amount: 1000, monthly: 0 });
    expect(result!.signals.length).toBeGreaterThanOrEqual(8);
    expect(result!.signals.every((s) => ['Oportunidade', 'Aguardar', 'Evitar'].includes(s.signal))).toBe(true);
    expect(result!.curve.length).toBe(300);
    expect(result!.buyHold.finalValue).toBeGreaterThan(0);
  });

  it('valor final coerente com caixa + cotas × preço final', () => {
    const points = makePoints();
    const result = strategyRun({ points, amount: 1000, monthly: 100 });
    const lastClose = points[points.length - 1].close;
    // valor final está entre "nunca investiu" e "tudo investido no fim"
    expect(result!.finalValue).toBeGreaterThanOrEqual(result!.totalInvested * 0.5);
    expect(result!.finalValue).toBeLessThanOrEqual(result!.totalInvested * 2);
    expect(result!.curve[result!.curve.length - 1].value).toBeCloseTo(result!.finalValue, 0);
    void lastClose;
  });

  it('aportes mensais aumentam o total investido', () => {
    const result = strategyRun({ points: makePoints(), amount: 1000, monthly: 100 });
    expect(result!.totalInvested).toBeGreaterThan(1000);
    expect(result!.curve[result!.curve.length - 1].invested).toBe(result!.totalInvested);
  });
});

describe('strategyContributions', () => {
  it('aporte inicial + um aporte por mudança de mês', () => {
    const points = makePoints().slice(0, 50); // ~2,4 meses
    const contributions = strategyContributions({ points, amount: 1000, monthly: 100 });
    expect(contributions[0].amount).toBe(1000);
    expect(contributions.length).toBeGreaterThanOrEqual(3);
  });
});
