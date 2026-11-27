import { aggregate, EVAL_CASES, EvalCase, scoreAnswer } from './prompt-eval';

describe('prompt eval', () => {
  const goodAnswer = {
    content:
      'NU (Nubank) está em posição desfavorável. Preço USD 12,36, tendência lateral, abaixo da MM50, ' +
      'RSI 48 e suporte em 12,19 com resistência em 12,89. Fonte: get_stock_outlook em 27/11/2026. ' +
      'O que observaria: recuperar a MM50 com RSI acima de 55. Conteúdo educacional, sem recomendação.',
    tools: ['get_stock_outlook'],
  };

  const evalCase: EvalCase = EVAL_CASES[0];

  it('resposta boa com tool, números, fonte e aviso único pontua alto', () => {
    const result = scoreAnswer(goodAnswer, evalCase);
    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.checks.find((c) => c.name.includes('tool'))?.ok).toBe(true);
  });

  it('sem tool esperada perde peso', () => {
    const result = scoreAnswer({ ...goodAnswer, tools: [] }, evalCase);
    expect(result.score).toBeLessThan(80);
  });

  it('sem números e sem fonte perde pontos', () => {
    const result = scoreAnswer(
      { content: 'Não tenho dados suficientes para responder com segurança.', tools: ['get_stock_outlook'] },
      evalCase,
    );
    expect(result.score).toBeLessThan(70);
  });

  it('promessa futura e frase proibida derrubam a nota', () => {
    const result = scoreAnswer(
      {
        content:
          'Vou verificar isso agora. Compre agora que é garantido. ' +
          'Conteúdo educacional. Conteúdo educacional. Conteúdo educacional.',
        tools: ['get_stock_outlook'],
      },
      { ...evalCase, forbidden: ['compre agora'] },
    );
    expect(result.checks.find((c) => c.name.includes('promessa'))?.ok).toBe(false);
    expect(result.checks.find((c) => c.name.includes('proibida'))?.ok).toBe(false);
  });

  it('agrega a média dos casos', () => {
    expect(aggregate([{ id: 'a', score: 100, checks: [] }, { id: 'b', score: 50, checks: [] }])).toBe(75);
    expect(aggregate([])).toBe(0);
  });
});
