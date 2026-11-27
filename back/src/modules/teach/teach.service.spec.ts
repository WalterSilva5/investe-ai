import { validateExercise } from './teach.service';

describe('validação de exercícios de ensino', () => {
  const live = {
    trend: 'baixa',
    rsi14: 28,
    support: 40.87,
    resistance: 43.42,
    ratio: 1.8,
    halvingDaysBeforeNext: 505,
  };

  it('tendência correta (case-insensitive)', () => {
    const result = validateExercise({type:'trend'}, live, '  Baixa ');
    expect(result.correct).toBe(true);
    expect(result.expected).toContain('baixa');
  });

  it('tendência errada devolve explicação do porquê', () => {
    const result = validateExercise({type:'trend'}, live, 'alta');
    expect(result.correct).toBe(false);
    expect(result.explanation).toContain('abaixo das médias');
  });

  it('suporte numérico com vírgula e dentro da tolerância acerta', () => {
    const result = validateExercise({type:'support'}, live, '40,90');
    expect(result.correct).toBe(true);
  });

  it('suporte fora da tolerância erra', () => {
    const result = validateExercise({type:'support'}, live, '38,00');
    expect(result.correct).toBe(false);
  });

  it('zona de RSI correta (28 → sobrevenda)', () => {
    const result = validateExercise({type:'rsi-zone'}, live, 'sobrevenda');
    expect(result.correct).toBe(true);
    expect(result.explanation).toContain('não é sinal de compra');
  });

  it('relação ganho/risco com tolerância acerta', () => {
    const result = validateExercise({type:'ratio'}, live, '1,9');
    expect(result.correct).toBe(true);
  });

  it('relação por escolha (favorável/contra) também valida', () => {
    expect(validateExercise({type:'ratio'}, live, 'favorável').correct).toBe(true);
    expect(validateExercise({type:'ratio'}, live, 'contra').correct).toBe(false);
  });

  it('quiz conceitual usa gabarito fixo (custódia)', () => {
    const exercise = {
      type: 'quiz' as const,
      question: 'q',
      hint: 'h',
      choices: ['exchange', 'hot wallet', 'cold wallet'],
      answer: 'cold wallet',
      explanation: 'Chaves offline, fora do alcance de hack de exchange.',
    };
    expect(validateExercise(exercise, live, 'cold wallet').correct).toBe(true);
    const wrong = validateExercise(exercise, live, 'exchange');
    expect(wrong.correct).toBe(false);
    expect(wrong.explanation).toContain('offline');
  });

  it('contagem de dias do halving com tolerância ±25', () => {
    expect(validateExercise({type:'halving-days'}, live, '505').correct).toBe(true);
    expect(validateExercise({type:'halving-days'}, live, '520').correct).toBe(true);
    expect(validateExercise({type:'halving-days'}, live, '600').correct).toBe(false);
  });
});
