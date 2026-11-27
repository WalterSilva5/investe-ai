import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { QuotesService } from '../../market/quotes.service';
import { AiProviderRegistry } from '../../ai-provider/ai-provider.registry';
import { classifySymbol, ASSET_CLASSES } from './asset-classes';
import { SIM_PERSONA, OUTPUT_CONTRACT, variantFor } from './prompt-variants';

/**
 * Backtest de prompts por classe de ativo ("simulações"):
 *
 * Para cada âncora do passado (janela que ainda tem 20+ pregões à frente),
 * reconstrói o estado do gráfico COMO ESTAVA naquele dia, pede uma leitura
 * direcional ao LLM com cada variante de prompt, e compara com o retorno
 * REALIZADO nos 20 pregões seguintes.
 *
 * Score por variante/classe: taxa de acerto direcional (com banda lateral)
 * + nota Brier simplificada (castiga confiança em direção errada).
 *
 * É uma simulação de análise, não de execução: nada disso é recomendação.
 */

interface AnchorCall {
  symbol: string;
  classId: string;
  variantId: string;
  anchorDate: string;
  direction: string;
  confidence: number;
  realized20dPct: number;
  lateralBandPct?: number;
  hit: boolean;
  why?: string;
}

const HORIZON = 20; // pregões
const LATERAL_BAND = 2.5; // |retorno| < banda ⇒ resultado lateral
const DEFAULT_SYMBOLS_BY_CLASS: Record<string, string[]> = {
  banco: ['ITUB4', 'BBDC4'],
  commodity: ['PETR4', 'VALE3'],
  tecnologia: ['MSFT', 'NVDA'],
  consumo: ['MGLU3', 'ABEV3'],
  industrial: ['WEGE3'],
  juros: ['MXRF11', 'HGLG11'],
  cripto: ['BTC'],
  etf: ['IVVB11'],
};

@Injectable()
export class PromptSimService {
  private readonly logger = new Logger(PromptSimService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly quotes: QuotesService,
    private readonly registry: AiProviderRegistry,
  ) {}

  /**
   * Roda a matriz símbolo × variante e grava um PromptSimRun por (classe, variante).
   * `anchors` = número de âncoras por símbolo (padrão 8, espaçadas).
   */
  async run(input: {
    symbols?: string[];
    classes?: string[];
    anchors?: number;
    model?: string;
  }) {
    const tenantId = await this.resolveTenant();
    const resolved = await this.registry.resolve(tenantId, 'opencode', input.model || 'glm-5.3-flash');
    const anchorsPerSymbol = Math.max(3, Math.min(14, input.anchors ?? 8));

    const requestedClasses = input.classes?.length
      ? input.classes
      : Object.keys(DEFAULT_SYMBOLS_BY_CLASS);
    const symbolList = input.symbols?.length
      ? input.symbols.map((s) => s.trim().toUpperCase()).filter(Boolean)
      : requestedClasses.flatMap((c) => DEFAULT_SYMBOLS_BY_CLASS[c] || []);

    if (!symbolList.length) {
      throw new Error('Nenhum símbolo para simular (verifique classes pedidas).');
    }

    // Agrupa símbolos pedidos por classe.
    const byClass = new Map<string, string[]>();
    for (const symbol of symbolList) {
      const cls = classifySymbol(symbol);
      if (!byClass.has(cls.id)) byClass.set(cls.id, []);
      byClass.get(cls.id)!.push(symbol);
    }

    const saved: unknown[] = [];
    for (const [classId, symbols] of byClass) {
      for (const variantId of ['base', 'classe', 'classe-rigor']) {
        const run = await this.runClassVariant(
          resolved,
          classId,
          symbols,
          variantId,
          anchorsPerSymbol,
        );
        const stored = await this.prisma.promptSimRun.create({
          data: {
            classId,
            variantId,
            symbols: symbols as never,
            anchors: run.anchors,
            calls: run.calls,
            hits: run.hits,
            hitRate: run.calls ? run.hits / run.calls : 0,
            score: run.score,
            details: run.details as never,
            model: resolved.model,
          },
        });
        saved.push({
          id: stored.id,
          classId,
          variantId,
          symbols,
          anchors: run.anchors,
          calls: run.calls,
          hits: run.hits,
          hitRate: run.calls ? Math.round((run.hits / run.calls) * 1000) / 10 : 0,
          score: run.score,
        });
      }
    }
    return { model: resolved.model, runs: saved };
  }

  /** Últimos resultados agregados (para a UI e para escolher o prompt ativo). */
  async results(limit = 60) {
    const rows = await this.prisma.promptSimRun.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map((row) => ({
      id: row.id,
      classId: row.classId,
      classLabel: ASSET_CLASSES[row.classId]?.label || row.classId,
      variantId: row.variantId,
      symbols: row.symbols as string[],
      anchors: row.anchors,
      calls: row.calls,
      hits: row.hits,
      hitRatePct: row.calls ? Math.round((row.hits / row.calls) * 1000) / 10 : 0,
      score: row.score,
      model: row.model,
      createdAt: row.createdAt,
    }));
  }

  /** Melhor variante por classe (maior nota entre runs recentes da classe). */
  async bestPerClass() {
    const rows = await this.prisma.promptSimRun.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    const best = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      const current = best.get(row.classId);
      if (!current || row.score > current.score) best.set(row.classId, row);
    }
    return [...best.values()].map((row) => ({
      classId: row.classId,
      classLabel: ASSET_CLASSES[row.classId]?.label || row.classId,
      variantId: row.variantId,
      score: row.score,
      hitRatePct: row.calls ? Math.round((row.hits / row.calls) * 1000) / 10 : 0,
      calls: row.calls,
      createdAt: row.createdAt,
    }));
  }

  /** Instrução vencedora de uma classe (para plugar no chat). */
  async winningInstruction(classId: string): Promise<string | null> {
    const best = await this.prisma.promptSimRun.findFirst({
      where: { classId },
      orderBy: { score: 'desc' },
    });
    if (!best || best.variantId === 'base') return null;
    return variantFor(classId, best.variantId).instruction.slice(0, 600);
  }

  // ── Internos ───────────────────────────────────────────────────────────────

  private async runClassVariant(
    resolved: { provider: any; model: string },
    classId: string,
    symbols: string[],
    variantId: string,
    anchorsPerSymbol: number,
  ): Promise<{ anchors: number; calls: number; hits: number; score: number; details: unknown }> {
    const variant = variantFor(classId, variantId);
    const calls: AnchorCall[] = [];

    for (const symbol of symbols) {
      let points: Array<{ date: string; close: number }>;
      try {
        // Cripto: CoinGecko bloqueia 2y sem chave paga — 1y basta (366 barras).
        ({ points } = await this.quotes.history(symbol, classifySymbol(symbol).id === 'cripto' ? '1y' : '2y'));
      } catch (error) {
        this.logger.warn(`Sem histórico para ${symbol}: ${(error as Error).message}`);
        continue;
      }
      const closes = points.map((p) => p.close);
      if (closes.length < 120 + HORIZON) continue;

      const anchorIdx = this.pickAnchors(closes.length, anchorsPerSymbol);
      const sims = anchorIdx.map(async (idx) => {
        try {
          return await this.callAt(
            resolved,
            variant,
            classId,
            symbol,
            points,
            closes,
            idx,
          );
        } catch (error) {
          this.logger.warn(
            `Falha em ${symbol}@${points[idx]?.date} (${variantId}): ${(error as Error).message}`,
          );
          return null;
        }
      });
      const settled = await Promise.all(sims);
      for (const call of settled) if (call) calls.push(call);
    }

    const hitCount = calls.filter((c) => c.hit).length;
    // Score: acerto (0-100) menos a média de penalidade por erro confiante
    // (Brier simplificado por chamada: errar com confiança custa até 25 pontos/chamada).
    const penaltySum = calls.reduce(
      (acc, c) => acc + (c.hit ? 0 : (c.confidence / 100) * 25),
      0,
    );
    const penaltyAvg = calls.length ? penaltySum / calls.length : 0;
    const score = calls.length
      ? Math.max(0, Math.round(((hitCount / calls.length) * 100 - penaltyAvg) * 10) / 10)
      : 0;

    return {
      anchors: anchorsPerSymbol,
      calls: calls.length,
      hits: hitCount,
      score,
      details: { calls: calls.slice(0, 120) },
    };
  }

  /** Âncoras espaçadas dentro da janela viável (tem 20+ pregões à frente). */
  private pickAnchors(total: number, count: number): number[] {
    const first = 140; // garante janela técnica razoável antes da âncora
    const last = total - HORIZON - 1;
    if (last <= first) return [];
    const step = Math.max(5, Math.floor((last - first) / Math.max(1, count - 1)));
    const out: number[] = [];
    for (let i = 0; i < count; i += 1) {
      const idx = Math.min(last, first + i * step);
      if (!out.includes(idx)) out.push(idx);
    }
    return out;
  }

  /** Reconstrói o estado do gráfico na âncora e pergunta a direção ao LLM. */
  private async callAt(
    resolved: { provider: any; model: string },
    variant: { id: string; instruction: string },
    classId: string,
    symbol: string,
    points: Array<{ date: string; close: number }>,
    closes: number[],
    idx: number,
  ): Promise<AnchorCall> {
    const window = closes.slice(0, idx + 1);
    const price = closes[idx];
    const ma20 = avg(window.slice(-20));
    const ma50 = avg(window.slice(-50));
    const ma200 = window.length >= 200 ? avg(window.slice(-200)) : null;
    const rsi14 = rsiAt(window);
    const monthRet = pct(window[idx - 21] ?? window[0], price);
    const quarterRet = pct(window[idx - 63] ?? window[0], price);
    const recent = window.slice(-30).map((c) => round2(c)).join(', ');
    const supports = localLevels(window, 60, 'min');
    const resistances = localLevels(window, 60, 'max');
    const support = nearest(supports, price, -1);
    const resistance = nearest(resistances, price, +1);
    const anchorDate = points[idx]?.date || 'data desconhecida';
    // Amplitude típica de 20 pregões (vol anualizada da própria janela) — o que é
    // "lateral" num ativo volátil é movimento normal, não sinal.
    const annualVol = annualizedVolPct(window);
    const typicalMove = annualVol != null ? annualVol * Math.sqrt(HORIZON / 252) : null;
    const lateralBand = typicalMove != null ? Math.max(LATERAL_BAND, typicalMove * 0.5) : LATERAL_BAND;

    const context = [
      `Ativo: ${symbol} (classe interna: ${classId}). Data da âncora: ${anchorDate} (ponto final da janela).`,
      `Fechamento atual: ${round2(price)} BRL.`,
      ma20 ? `Média móvel 20: ${round2(ma20)} (${price >= ma20 ? 'preço acima' : 'preço abaixo'}).` : '',
      ma50 ? `Média móvel 50: ${round2(ma50)} (${price >= ma50 ? 'preço acima' : 'preço abaixo'}).` : '',
      ma200 ? `Média móvel 200: ${round2(ma200)} (${price >= ma200 ? 'preço acima' : 'preço abaixo'}).` : '',
      rsi14 != null ? `RSI(14): ${rsi14}.` : '',
      `Retorno último mês: ${fmtPct(monthRet)}; último trimestre: ${fmtPct(quarterRet)}.`,
      support != null ? `Suporte técnico próximo (60 pregões): ${round2(support)} (${fmtPct(pct(support, price))}).` : '',
      resistance != null ? `Resistência técnica próxima (60 pregões): ${round2(resistance)} (${fmtPct(pct(resistance, price))}).` : '',
      typicalMove != null
        ? `Movimento típico deste ativo em 20 pregões: ±${round2(typicalMove)}% — retornos dentro dessa amplitude são RUÍDO, não tendência; use "lateral" quando sua expectativa couber nesse ruído.`
        : '',
      `Últimos 30 fechamentos: ${recent}.`,
    ]
      .filter(Boolean)
      .join('\n');

    const response = await resolved.provider.chat(
      [
        { role: 'system', content: `${SIM_PERSONA} ${variant.instruction}` },
        {
          role: 'user',
          content: `Estado do gráfico:\n${context}\n\n${OUTPUT_CONTRACT}`,
        },
      ],
      { model: resolved.model, temperature: 0.2, maxTokens: 400 },
    );

    const parsed = parseDirection(String(response.content || ''));
    const realized = idx + HORIZON < closes.length
      ? pct(closes[idx], closes[idx + HORIZON])
      : null;
    if (realized == null) throw new Error('sem retorno futuro na janela');
    const realizedAbs = Math.abs(realized);
    const realizedDir =
      realizedAbs < lateralBand ? 'lateral' : realized > 0 ? 'alta' : 'baixa';
    const hit = parsed.direction === realizedDir;

    return {
      symbol,
      classId,
      variantId: variant.id,
      anchorDate,
      direction: parsed.direction,
      confidence: parsed.confidence,
      realized20dPct: round2(realized),
      lateralBandPct: round2(lateralBand),
      hit,
      why: parsed.why?.slice(0, 90),
    };
  }

  private async resolveTenant(): Promise<string> {
    const demo = await this.prisma.tenant.findUnique({ where: { slug: 'demo' } });
    if (demo) return demo.id;
    const first = await this.prisma.tenant.findFirst();
    if (!first) throw new Error('Nenhum tenant configurado.');
    return first.id;
  }
}

// ── Helpers puros ─────────────────────────────────────────────────────────────

function avg(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function pct(from: number, to: number): number {
  if (!from || from <= 0) return 0;
  return (to / from - 1) * 100;
}

function fmtPct(value: number | null): string {
  if (value == null) return '—';
  return `${value >= 0 ? '+' : ''}${round2(value)}%`;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** RSI simples de 14 (equivalente ao cálculo clássico de janela fixa). */
function rsiAt(closes: number[]): number | null {
  if (closes.length < 15) return null;
  let gain = 0;
  let loss = 0;
  for (let i = closes.length - 14; i < closes.length; i += 1) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gain += diff;
    else loss -= diff;
  }
  if (loss === 0) return 100;
  const rs = gain / loss;
  return Math.round((100 - 100 / (1 + rs)) * 100) / 100;
}

/** Volatilidade anualizada (%) da janela (desvio-padrão dos retornos × √252). */
function annualizedVolPct(window: number[]): number | null {
  if (window.length < 21) return null;
  const returns: number[] = [];
  for (let i = 1; i < window.length; i += 1) {
    if (window[i - 1] > 0) returns.push(window[i] / window[i - 1] - 1);
  }
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.reduce((acc, r) => acc + (r - mean) * (r - mean), 0) / (returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

/** Mínimos/máximos locais na janela (para suporte/resistência da âncora). */
function localLevels(window: number[], lookback: number, kind: 'min' | 'max'): number[] {
  const slice = window.slice(-lookback);
  const levels: number[] = [];
  for (let i = 2; i < slice.length - 2; i += 1) {
    const [a, b, c, d, e] = [slice[i - 2], slice[i - 1], slice[i], slice[i + 1], slice[i + 2]];
    if (kind === 'min' && c <= a && c <= b && c <= d && c <= e) levels.push(c);
    if (kind === 'max' && c >= a && c >= b && c >= d && c >= e) levels.push(c);
  }
  // Agrega níveis próximos (±1,5%).
  const merged: number[] = [];
  for (const level of levels.sort((x, y) => x - y)) {
    const last = merged[merged.length - 1];
    if (last != null && Math.abs(level - last) / last < 0.015) merged[merged.length - 1] = (last + level) / 2;
    else merged.push(level);
  }
  return merged;
}

function nearest(levels: number[], price: number, side: -1 | 1): number | null {
  const candidates = levels
    .filter((l) => (side === -1 ? l < price : l > price))
    .map((l) => ({ l, dist: Math.abs(l / price - 1) }))
    .sort((a, b) => a.dist - b.dist);
  return candidates.length ? candidates[0].l : null;
}

/** Parser tolerante do JSON de resposta (provider às vezes corta/envolve em texto). */
export function parseDirection(raw: string): {
  direction: string;
  confidence: number;
  why?: string;
} {
  const fallback = { direction: 'lateral', confidence: 30, why: 'resposta ilegível' };
  if (!raw) return fallback;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) return fallback;
  let text = raw.slice(start, end + 1);
  // Reparo: caracteres de controle dentro de strings e vírgula pendente.
  text = text.replace(/[\u0000-\u001f]+/g, ' ').replace(/,(\s*[}\]])/g, '$1');
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const direction = String(parsed.direction || '').toLowerCase();
    const valid = ['alta', 'baixa', 'lateral'].includes(direction) ? direction : 'lateral';
    const confidence = Math.max(0, Math.min(100, Number(parsed.confidence) || 0));
    return { direction: valid, confidence, why: parsed.why ? String(parsed.why) : undefined };
  } catch {
    // Salvamento por regex (respostas parciais).
    const match = raw.match(/"direction"\s*:\s*"(alta|baixa|lateral)"/i);
    if (match) return { direction: match[1].toLowerCase(), confidence: 40 };
    return fallback;
  }
}
