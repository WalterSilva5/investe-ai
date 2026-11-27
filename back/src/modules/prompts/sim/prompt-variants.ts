/**
 * Variantes de prompt para o backtest. Cada variante é uma instrução de sistema
 * que se soma a uma persona compacta de analista. O objetivo é medir qual
 * framing prevê melhor a direção futura (20 pregões) por classe de ativo.
 */

export interface PromptVariant {
  id: string;
  label: string;
  /** Instrução acrescentada (a variante `base` é o controle, sem framing). */
  instruction: string;
}

/** Persona base compartilhada por todas as variantes (mantém a comparação justa). */
export const SIM_PERSONA = [
  'Você é um analista técnico quantitativo. Recebe o estado do gráfico de um ativo em uma data do passado',
  '(preço, médias, RSI, níveis, momentum, volatilidade e preços recentes) e dá uma única leitura direcional',
  'para os próximos 20 pregões. Nada além de JSON. Não recomenda compra ou venda: é um exercício de leitura.',
].join(' ');

export const OUTPUT_CONTRACT =
  'Responda SOMENTE com JSON válido: {"direction":"alta|baixa|lateral","confidence":0-100,"why":"<= 15 palavras"}. ' +
  'Sem markdown, sem texto fora do JSON.';

/** Controle: sem nenhum enquadramento de setor. */
export const VARIANT_BASE: PromptVariant = {
  id: 'base',
  label: 'Base (controle, sem classe)',
  instruction:
    'Leia apenas o gráfico: tendência, médias, RSI e níveis. Não assuma nada sobre o setor do ativo.',
};

/** Variante 2: enquadra o tipo de ativo e orienta o que olhar primeiro. */
export const VARIANT_CLASS: PromptVariant = {
  id: 'classe',
  label: 'Enquadramento por classe',
  instruction: '', // preenchida por variantFor(classId)
};

/** Variante 3: classe + gating de confirmação (só chama direção com confluência). */
export const VARIANT_CLASS_RIGOR: PromptVariant = {
  id: 'classe-rigor',
  label: 'Classe + rigor de confirmação',
  instruction: '', // preenchida por variantFor(classId)
};

export function variantFor(classId: string, variantId: string): PromptVariant {
  const base = (framing: string, rigor?: string) => {
    if (variantId === 'base') return VARIANT_BASE;
    if (variantId === 'classe') {
      return {
        id: 'classe',
        label: `Enquadramento por classe (${classId})`,
        instruction:
          `Tipo de ativo em análise: ${framing} ` +
          'Comece a leitura por esse motor do setor e só depois confirme (ou contradiga) com o gráfico.',
      } satisfies PromptVariant;
    }
    return {
      id: 'classe-rigor',
      label: `Classe + rigor de confirmação (${classId})`,
      instruction:
        `Tipo de ativo em análise: ${framing} ` +
        'Regras de confirmação: chame "alta" só se preço estiver acima da MM20 E da MM50 (ou RSI recuperando de sobrevenda com preço no suporte); ' +
        'chame "baixa" só se preço estiver abaixo de ambas (ou RSI esticado ≥ 70 com topo no período); ' +
        'conflito entre momentum e níveis, ou range sem direção → "lateral". Use o setor como lente, não como motivo para contrariar o gráfico.' +
        (rigor ? ` ${rigor}` : ''),
    } satisfies PromptVariant;
  };

  switch (classId) {
    case 'banco':
      return base(
        'bancos dependem do ciclo de crédito e do spread: juro alto sustenta margem mas aumenta inadimplência; crescer a carteira importa mais que commodity.',
      );
    case 'commodity':
      return base(
        'exportadoras seguem a commodity (petróleo/minério/soja) e o câmbio: real fraco aumenta a receita em reais; o gráfico da ação tende a seguir a commodity.',
      );
    case 'tecnologia':
      return base(
        'tech responde a crescimento de lucro e a juros longos: juro alto comprime o múltiplo; momentum tende a persistir e reversões vêm de decepção de guia.',
      );
    case 'consumo':
      return base(
        'varejo/consumo segue ciclo doméstico: massa salarial, crédito e confiança; margem sob guerra de preço é o risco clássico.',
      );
    case 'industrial':
      return base(
        'industriais de qualidade seguem execução: margem estável e crescimento de receita; menos sensíveis a câmbio e commodity.',
      );
    case 'juros':
      return base(
        'FIIs/utilities são sensíveis a juro: juro alto pressiona a cota para baixo; o nível do juro longo é o principal motor, não o humor da bolsa.',
      );
    case 'cripto':
      return base(
        'cripto segue liquidez global e o ciclo do halving: amplitude enorme, tendências persistem mais e drawdowns de 70% fazem parte.',
      );
    case 'etf':
      return base(
        'ETF segue o índice: leia regime de mercado (risk-on/off) e fluxo, não a análise de empresa.',
      );
    default:
      return base('leia o gráfico e o regime de mercado sem viés de setor.');
  }
}
