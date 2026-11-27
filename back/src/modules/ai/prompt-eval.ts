/**
 * Avaliação de prompts: roda um conjunto dourado de perguntas e pontua a
 * resposta por critérios objetivos (usou tool, citou números/fonte, não
 * prometeu, aviso único). Serve para comparar candidato × versão ativa.
 * Não julga "boniteza" — julga aderência às regras do produto.
 */

export interface EvalCase {
  id: string;
  question: string;
  /** Tools que deveriam ser usadas (basta uma). */
  expectTools?: string[];
  /** Termos que a resposta precisa conter (case-insensitive). */
  mustMention?: string[];
  /** Frases que não podem aparecer. */
  forbidden?: string[];
}

export interface EvalAnswer {
  content: string;
  tools: string[];
}

export interface EvalCheck {
  name: string;
  weight: number;
  ok: boolean;
  detail?: string;
}

export interface EvalCaseScore {
  id: string;
  score: number;
  checks: EvalCheck[];
}

export const EVAL_CASES: EvalCase[] = [
  {
    id: 'ativo-nu',
    question: 'A ação do Nubank (NU) está em boa posição hoje?',
    expectTools: ['get_stock_outlook'],
    mustMention: ['RSI', 'suporte', 'tendência'],
    forbidden: ['compre agora', 'venda agora'],
  },
  {
    id: 'alocacao',
    question: 'Qual é a minha alocação atual por tipo de ativo?',
    expectTools: ['get_allocation', 'get_portfolio_summary'],
    mustMention: ['%'],
  },
  {
    id: 'renda-fixa',
    question: 'Compare CDB 100% do CDI com LCI 90% em 12 meses.',
    expectTools: ['simulate_fixed_income', 'get_macro'],
    mustMention: ['IR', 'CDI'],
  },
  {
    id: 'ciclo-btc',
    question: 'Onde estamos no ciclo do halving do Bitcoin?',
    expectTools: ['get_stock_outlook', 'get_briefing', 'get_macro'],
    mustMention: ['halving'],
  },
  {
    id: 'risco-fiscal',
    question: 'A Selic alta é consequência do gasto público? Separe fato de narrativa.',
    mustMention: ['fiscal'],
    forbidden: ['com certeza', 'garantido'],
  },
];

const DISCLAIMER_PATTERN = /não é recomendação|não constitui recomendação|conteúdo educacional/gi;
const PROMISE_PATTERN = /\b(vou (verificar|listar|confirmar|buscar|checar)|irei (verificar|listar|confirmar))\b/i;

/** Pontua uma resposta de 0 a 100 conforme o caso. */
export function scoreAnswer(answer: EvalAnswer, evalCase: EvalCase): EvalCaseScore {
  const content = answer.content || '';
  const lower = content.toLowerCase();
  const checks: EvalCheck[] = [];

  checks.push({
    name: 'resposta não vazia',
    weight: 15,
    ok: content.trim().length > 0,
  });
  checks.push({
    name: 'resposta completa (>=250 chars)',
    weight: 10,
    ok: content.trim().length >= 250,
    detail: `${content.trim().length} chars`,
  });
  checks.push({
    name: 'traz números',
    weight: 10,
    ok: /\d/.test(content),
  });
  checks.push({
    name: 'cita fonte/proveniência',
    weight: 10,
    ok: /fonte|brapi|coingecko|yahoo|bcb|ferramenta|get_/i.test(content),
  });

  if (evalCase.expectTools?.length) {
    const used = answer.tools || [];
    const hit = evalCase.expectTools.filter((tool) => used.includes(tool));
    checks.push({
      name: `usou tool esperada (${evalCase.expectTools.join(' | ')})`,
      weight: 25,
      ok: hit.length > 0,
      detail: used.length ? `usou: ${used.join(', ')}` : 'nenhuma tool',
    });
  } else {
    checks.push({ name: 'tool esperada', weight: 25, ok: true, detail: 'caso sem tool obrigatória' });
  }

  const mentions = evalCase.mustMention || [];
  const mentioned = mentions.filter((term) => lower.includes(term.toLowerCase()));
  checks.push({
    name: 'menciona os pontos-chave',
    weight: 10,
    ok: mentions.length === 0 || mentioned.length >= Math.ceil(mentions.length * 0.6),
    detail: `${mentioned.length}/${mentions.length}`,
  });

  const disclaimers = (content.match(DISCLAIMER_PATTERN) || []).length;
  checks.push({
    name: 'aviso educacional no máximo uma vez',
    weight: 10,
    ok: disclaimers <= 1,
    detail: `${disclaimers} ocorrência(s)`,
  });

  checks.push({
    name: 'não termina em promessa',
    weight: 5,
    ok: !PROMISE_PATTERN.test(content),
  });

  const forbidden = (evalCase.forbidden || []).filter((term) => lower.includes(term.toLowerCase()));
  checks.push({
    name: 'sem frase proibida',
    weight: 5,
    ok: forbidden.length === 0,
    detail: forbidden.length ? `encontrado: ${forbidden.join(', ')}` : undefined,
  });

  const totalWeight = checks.reduce((sum, check) => sum + check.weight, 0);
  const earned = checks.filter((check) => check.ok).reduce((sum, check) => sum + check.weight, 0);
  return {
    id: evalCase.id,
    score: Math.round((earned / totalWeight) * 100),
    checks,
  };
}

/** Nota final: média simples dos casos. */
export function aggregate(scores: EvalCaseScore[]): number {
  if (!scores.length) return 0;
  return Math.round(scores.reduce((sum, item) => sum + item.score, 0) / scores.length);
}
