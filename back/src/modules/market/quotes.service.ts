import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AssetType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PortfoliosService } from '../portfolios/portfolios.service';
import {
  annualizedVolatility,
  changePct,
  levelsAround,
  movingAverage,
  rsi,
  setupStats,
  technicalReading,
  agentSignal,
  SetupKind,
} from './indicators';
import { halvingContext } from './halving';
import { SeerCandidate, rankSeers, summarizeSetups } from './seer';
import { DISCOVERY_UNIVERSE } from '../discovery/universe';

const SETUP_LABELS: Record<SetupKind, string> = {
  support: 'Teste de suporte (a até 2% da mínima de 20 barras)',
  'rsi-oversold': 'RSI entrando em sobrevenda (cruzou para ≤ 35)',
  'ma50-cross': 'Preço cruzando acima da MM50',
};

export interface Quote {
  symbol: string;
  price: number;
  currency: string;
  source: string;
  fetchedAt: string;
}

interface HistoryResult {
  points: Array<{ date: string; close: number }>;
  currency: string;
  source: string;
}

export const CRYPTO_IDS: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  ADA: 'cardano',
  XRP: 'ripple',
  DOGE: 'dogecoin',
  BNB: 'binancecoin',
  USDT: 'tether',
  USDC: 'usd-coin',
};

@Injectable()
export class QuotesService {
  private readonly logger = new Logger(QuotesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly portfolios: PortfoliosService,
  ) {}

  async getQuote(symbol: string, type: AssetType = AssetType.STOCK): Promise<Quote> {
    if (type === AssetType.CRYPTO) {
      return this.cryptoQuote(symbol);
    }
    return this.b3Quote(symbol);
  }

  /**
   * Indicadores para o dashboard de tracking: preço, médias, RSI,
   * volatilidade e variações em 1d/1s/1m/3m/1a. Determinístico.
   */
  async indicators(rawSymbol: string, range = '1y') {
    const { symbol, range: used, source, currency, points } = await this.history(rawSymbol, range);
    const closes = points.map((p) => p.close);
    if (closes.length < 2) throw new NotFoundException(`Sem histórico suficiente para ${symbol}.`);
    const current = closes[closes.length - 1];
    const ma20 = movingAverage(closes, 20);
    const ma50 = movingAverage(closes, 50);
    const { supports, resistances } = levelsAround(closes);
    const nearestSupport = supports[0] ?? null;
    const nearestResistance = resistances[0] ?? null;
    return {
      symbol,
      range: used,
      source,
      currency,
      current,
      asOf: points[points.length - 1]?.date,
      changed: {
        d1: changePct(closes, 1),
        w1: changePct(closes, 5),
        m1: changePct(closes, 21),
        m3: changePct(closes, 63),
        y1: changePct(closes, 252),
      },
      min: Math.min(...closes),
      max: Math.max(...closes),
      ma20,
      ma50,
      vsMa20Pct: ma20 ? Math.round(((current - ma20) / ma20) * 10000) / 100 : null,
      vsMa50Pct: ma50 ? Math.round(((current - ma50) / ma50) * 10000) / 100 : null,
      rsi14: rsi(closes, 14),
      volatilityAnnualPct: annualizedVolatility(closes),
      supports,
      resistances,
      distSupportPct:
        nearestSupport && current > 0
          ? Math.round(((current - nearestSupport) / current) * 10000) / 100
          : null,
      distResistancePct:
        nearestResistance && current > 0
          ? Math.round(((nearestResistance - current) / current) * 10000) / 100
          : null,
      points: points.slice(-180),
    };
  }

  /** Frase de ciclo (halving) para BTC/ETH — contexto histórico, não previsão. */
  private halvingBullet(symbol: string): string {
    const ctx = halvingContext();
    if (symbol === 'BTC') {
      return `Ciclo do halving: ${ctx.phase}. ${ctx.phaseNote}`;
    }
    return `Ciclo: BTC está em ${ctx.phase.toLowerCase()} (~${ctx.daysBeforeNext} dias do próximo halving); ETH costuma acompanhar o ciclo.`;
  }

  /**
   * Resumo da ação: leitura técnica determinística + perspectiva em números
   * (tendência, momentum, risco/ganho até os níveis) e o histórico do padrão
   * que o papel vive agora. Não recomenda nem projeta preço.
   */
  async outlook(rawSymbol: string, range = '1y') {
    const { symbol, range: used, source, currency, points } = await this.history(rawSymbol, range);
    const closes = points.map((p) => p.close);
    if (closes.length < 60) {
      throw new NotFoundException(`Histórico insuficiente para ${symbol} (${closes.length} barras).`);
    }
    const { supports, resistances } = levelsAround(closes);
    const read = technicalReading(closes, { supports, resistances });

    // Padrão que o papel vive agora (para puxar o histórico correspondente).
    let setup: SetupKind = 'support';
    if (read.rsi14 != null && read.rsi14 <= 35) setup = 'rsi-oversold';
    else if (read.ma50 != null && read.ma20 != null && read.ma20 > read.ma50) setup = 'ma50-cross';
    const stats10 = setupStats(closes, setup, 10);
    const stats20 = setupStats(closes, setup, 20);
    const verdict = this.verdictFor(read, stats10.winRate, closes);

    const fmt = (value: number | null, digits = 2): string =>
      value == null ? '—' : `${currency === 'BRL' ? 'R$' : currency} ${value.toFixed(digits)}`;
    const pct = (value: number | null): string =>
      value == null ? '—' : `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

    const bullets: string[] = [
      `Veredito: ${verdict.signal} — ${verdict.headline}`,
      ...(closes.length && (symbol === 'BTC' || symbol === 'ETH')
        ? [this.halvingBullet(symbol)]
        : []),
      `Tendência ${read.trend}: preço ${fmt(read.target != null ? closes[closes.length - 1] : null)} ` +
        `${read.ma50 != null ? (closes[closes.length - 1] >= read.ma50 ? 'acima' : 'abaixo') : 'sem'} da MM50 ${fmt(read.ma50)}` +
        `${read.ma20 != null ? ` e ${closes[closes.length - 1] >= read.ma20 ? 'acima' : 'abaixo'} da MM20 ${fmt(read.ma20)}` : ''}.`,
      `Momentum: dia ${pct(read.dayChange)} · mês ${pct(read.monthChange)} · trimestre ${pct(read.quarterChange)}.`,
      `RSI(14) em ${read.rsi14 ?? '—'}: ${
        read.rsi14 == null
          ? 'sem leitura'
          : read.rsi14 >= 70
            ? 'zona de sobrecompra (movimento esticado)'
            : read.rsi14 <= 30
              ? 'zona de sobrevenda (pressão vendedora forte)'
              : 'zona neutra'
      }.`,
      `Suporte mais próximo ${fmt(read.stop)} (${pct(read.downsidePct == null ? null : -read.downsidePct)}) · ` +
        `resistência ${fmt(read.target)} (${pct(read.upsidePct)}).`,
      read.ratio != null
        ? `Relação ganho/risco até esses níveis: ${read.ratio.toFixed(2)} : 1.`
        : 'Sem os dois lados definidos (preço no extremo do período): relação ganho/risco indefinida.',
      `Volatilidade anual ${read.volatility ?? '—'}% — define o tamanho do ruído normal do papel.`,
      `Gatilho de melhora: ${verdict.trigger}`,
      `O que invalida: ${verdict.invalidation}`,
    ];

    return {
      symbol,
      range: used,
      source,
      currency,
      current: closes[closes.length - 1],
      asOf: points[points.length - 1]?.date,
      read,
      verdict,
      halving:
        symbol === 'BTC' || symbol === 'ETH'
          ? { appliesTo: symbol === 'BTC' ? 'BTC' : 'ETH (segue o ciclo do BTC)', ...halvingContext() }
          : null,
      bullets,
      pattern: {
        setup,
        label: SETUP_LABELS[setup],
        winRate10: stats10.winRate,
        avgReturn10: stats10.avgReturn,
        completed10: stats10.completed,
        winRate20: stats20.winRate,
        avgReturn20: stats20.avgReturn,
        completed20: stats20.completed,
      },
      disclaimer:
        'Leitura descritiva do estado atual (tendência, momentum, níveis) e do histórico do padrão. Não é previsão de preço nem recomendação de investimento; desempenho passado não garante resultado futuro.',
    };
  }

  /** Veredito direto + gatilho de melhora + o que invalida a leitura. */
  private verdictFor(
    read: {
      score: number;
      trend: 'alta' | 'baixa' | 'lateral';
      ratio: number | null;
      ma20: number | null;
      ma50: number | null;
      target: number | null;
      stop: number | null;
      rsi14: number | null;
    },
    patternWinRate: number | null,
    closes: number[],
  ): { signal: 'Oportunidade' | 'Aguardar' | 'Evitar'; headline: string; trigger: string; invalidation: string } {
    const ratio = read.ratio ?? 0;
    const signal = agentSignal(read);

    const headline =
      signal === 'Oportunidade'
        ? `Cenário favorável: tendência ${read.trend}, ganho/risco ${ratio.toFixed(2)}:1 e score ${read.score}/100.`
        : signal === 'Evitar'
          ? `Cenário desfavorável: tendência ${read.trend} com score ${read.score}/100${ratio > 0 ? ` e ganho/risco ${ratio.toFixed(2)}:1` : ''}.`
          : `Leitura neutra: tendência ${read.trend}, score ${read.score}/100${ratio > 0 ? ` e ganho/risco ${ratio.toFixed(2)}:1` : ''}.`;

    const trigger =
      signal === 'Evitar'
        ? read.ma50 != null && (read.ma50 ?? 0) > 0
          ? `Só mudaria de leitura se recuperasse a MM50 (${read.ma50.toFixed(2)}) com RSI acima de 55.`
          : `Só mudaria de leitura se rompesse ${read.target != null ? read.target.toFixed(2) : 'a resistência'} com volume e RSI acima de 55.`
        : signal === 'Oportunidade'
          ? `Segue favorável enquanto fechar acima da ${read.ma20 != null ? `MM20 (${read.ma20.toFixed(2)})` : 'mínima recente'}; alvo na resistência ${read.target != null ? read.target.toFixed(2) : '—'}.`
          : `Confirma se romper ${read.target != null ? read.target.toFixed(2) : 'a resistência'} com RSI acima de 55; sem isso, segue sem sinal.`;

    const invalidation =
      read.stop != null
        ? `Invalida se fechar abaixo do suporte ${read.stop.toFixed(2)} — aí o teste falhou.`
        : `Invalida se fechar abaixo da mínima do período (${Math.min(...closes).toFixed(2)}).`;

    const patternNote =
      patternWinRate != null
        ? ` Histórico do padrão: ${patternWinRate.toFixed(0)}% de acerto em 10 pregões (amostra pequena não é edge).`
        : '';

    return { signal, headline: headline + patternNote, trigger, invalidation };  }

  /**
   * "Vidente de dicas" geral: varre o universo, pega o padrão que cada papel
   * vive agora e ranqueia pelo histórico desse padrão (acerto + retorno),
   * ajustado pelo veredito atual. Não é previsão.
   */
  async seerScan(range = '1y', limit = 10, symbols?: string[]) {
    const list = symbols?.length
      ? [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))]
      : DISCOVERY_UNIVERSE.map((item) => item.symbol);
    const candidates: SeerCandidate[] = [];
    const failures: string[] = [];
    const CONCURRENCY = 4;

    for (let i = 0; i < list.length; i += CONCURRENCY) {
      const chunk = list.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        chunk.map(async (symbol) => {
          try {
            return { outlook: await this.outlook(symbol, range) };
          } catch {
            return { symbol, outlook: null };
          }
        }),
      );
      for (const result of results) {
        if (!result.outlook) {
          if ('symbol' in result && result.symbol) failures.push(result.symbol);
          continue;
        }
        const o = result.outlook;
        candidates.push({
          symbol: o.symbol,
          setup: o.pattern.setup,
          setupLabel: o.pattern.label,
          completed: o.pattern.completed10,
          winRate: o.pattern.winRate10,
          avgReturn: o.pattern.avgReturn10,
          avgReturn20: o.pattern.avgReturn20,
          verdict: o.verdict?.signal || 'Aguardar',
        });
      }
    }

    return {
      range,
      scanned: candidates.length,
      failures,
      items: rankSeers(candidates, limit),
      setups: summarizeSetups(candidates),
      disclaimer:
        'Histórico medido no próprio papel. Amostra pequena não entra. Desempenho passado não garante resultado futuro; não é recomendação.',
    };
  }

  /**
   * "Vidente de dicas": backtest do padrão no histórico do próprio papel.
   * Mede quantas vezes o setup funcionou e o retorno em +5/+10/+20 barras.
   * Não prevê preço — apenas descreve o passado.
   */
  async patternBacktest(rawSymbol: string, rawSetup?: string, range = '2y') {
    const setups: SetupKind[] = ['support', 'rsi-oversold', 'ma50-cross'];
    const setup = (rawSetup || 'support') as SetupKind;
    if (!setups.includes(setup)) {
      throw new BadRequestException('Padrão inválido. Use: support, rsi-oversold ou ma50-cross.');
    }
    const { symbol, range: used, source, currency, points } = await this.history(rawSymbol, range);
    const closes = points.map((p) => p.close);
    if (closes.length < 60) {
      throw new NotFoundException(`Histórico insuficiente para ${symbol} (${closes.length} barras).`);
    }
    const horizons = [5, 10, 20];
    return {
      symbol,
      range: used,
      source,
      currency,
      setup,
      setupLabel: SETUP_LABELS[setup],
      bars: closes.length,
      stats: horizons.map((h) => setupStats(closes, setup, h)),
      disclaimer:
        'Retorno medido no próprio histórico do papel. Desempenho passado não garante resultado futuro; não é recomendação de investimento.',
    };
  }

  /**
   * Níveis para o gráfico de oportunidade: suportes/resistências (mínimas e
   * máximas locais com janela de 5 pregões, agrupadas a 1,5%), médias móveis
   * de 20/50 e estatísticas do período. Determinístico, educacional.
   */
  async levels(
    rawSymbol: string,
    range = '6mo',
  ): Promise<{
    symbol: string;
    range: string;
    source: string;
    currency: string;
    current: number;
    changePct: number;
    min: number;
    max: number;
    ma20: number | null;
    ma50: number | null;
    supports: number[];
    resistances: number[];
    points: Array<{ date: string; close: number }>;
  }> {
    const { symbol, range: used, source, currency, points } = await this.history(rawSymbol, range);
    if (points.length < 2) throw new NotFoundException(`Sem histórico suficiente para ${symbol}.`);
    const closes = points.map((p) => p.close);
    const first = closes[0];
    const last = closes[closes.length - 1];
    const ma = (n: number): number | null => {
      if (closes.length < n) return null;
      const slice = closes.slice(-n);
      return Math.round((slice.reduce((a, b) => a + b, 0) / n) * 100) / 100;
    };
    const extrema = (kind: 'min' | 'max'): number[] => {
      const k = 5;
      const found: number[] = [];
      for (let i = k; i < closes.length - k; i += 1) {
        const window = closes.slice(i - k, i + k + 1);
        const v = closes[i];
        const isExtreme =
          kind === 'min' ? window.every((x) => v <= x) : window.every((x) => v >= x);
        if (isExtreme) found.push(v);
      }
      // agrupa níveis a até 1,5% de distância, mantendo o extremo do grupo
      const groups: number[][] = [];
      for (const v of (kind === 'min' ? found.sort((a, b) => a - b) : found.sort((a, b) => b - a))) {
        const g = groups.find((gg) => Math.abs(gg[0] - v) / gg[0] <= 0.015);
        if (g) g.push(v);
        else groups.push([v]);
      }
      const levels = groups.map((g) => (kind === 'min' ? Math.min(...g) : Math.max(...g)));
      // só vale o que está do lado certo do preço atual; mais próximos primeiro
      return levels
        .filter((v) => (kind === 'min' ? v < last : v > last))
        .sort((a, b) => Math.abs(a - last) - Math.abs(b - last))
        .slice(0, 3)
        .map((v) => Math.round(v * 100) / 100);
    };
    return {
      symbol,
      range: used,
      source,
      currency,
      current: last,
      changePct: first > 0 ? Math.round(((last - first) / first) * 10000) / 100 : 0,
      min: Math.min(...closes),
      max: Math.max(...closes),
      ma20: ma(20),
      ma50: ma(50),
      supports: extrema('min'),
      resistances: extrema('max'),
      points: points.slice(-400),
    };
  }

  /**
   * Histórico de cotação para gráfico (períodos estilo StatusInvest).
   * B3 via brapi (range: 1mo|3mo|6mo|1y|5y); cripto via CoinGecko.
   */
  async history(
    rawSymbol: string,
    range = '1y',
  ): Promise<{ symbol: string; range: string; source: string; currency: string; points: Array<{ date: string; close: number }> }> {
    const symbol = String(rawSymbol || '').trim().toUpperCase();
    if (!symbol) throw new BadRequestException('Informe o símbolo.');
    const allowed: Record<string, { brapi: string; days: number }> = {
      '1mo': { brapi: '1mo', days: 30 },
      '3mo': { brapi: '3mo', days: 90 },
      '6mo': { brapi: '6mo', days: 180 },
      '1y': { brapi: '1y', days: 365 },
      '2y': { brapi: '2y', days: 730 },
      '5y': { brapi: '5y', days: 1825 },
    };
    const spec = allowed[range];
    if (!spec) {
      throw new BadRequestException('Período inválido. Use: 1mo, 3mo, 6mo, 1y, 2y ou 5y.');
    }
    if (CRYPTO_IDS[symbol]) {
      return {
        symbol,
        range,
        source: 'coingecko',
        currency: 'BRL',
        points: await this.cryptoHistory(symbol, spec.days),
      };
    }
    const b3 = await this.b3History(symbol, spec.brapi);
    return { symbol, range, source: b3.source, currency: b3.currency, points: b3.points };
  }

  private async cryptoHistory(symbol: string, days: number): Promise<Array<{ date: string; close: number }>> {
    const id = CRYPTO_IDS[symbol];
    const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/market_chart?vs_currency=brl&days=${days}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new NotFoundException(`CoinGecko ${symbol}: HTTP ${response.status}`);
    }
    const data = (await response.json()) as { prices?: Array<[number, number]> };
    const points = (data.prices || [])
      .filter((p) => Array.isArray(p) && p[1] > 0)
      .map(([ts, price]) => ({ date: new Date(ts).toISOString().slice(0, 10), close: price }));
    if (!points.length) throw new NotFoundException(`Sem histórico para ${symbol}.`);
    return points;
  }

  private async b3History(symbol: string, range: string): Promise<HistoryResult> {
    const token = process.env.BRAPI_TOKEN;
    const url = `https://brapi.dev/api/quote/${encodeURIComponent(symbol)}?range=${range}&interval=1d${token ? `&token=${token}` : ''}`;
    const response = await fetch(url);
    if (response.ok) {
      const data = (await response.json()) as {
        results?: Array<{ historicalDataPrice?: Array<{ date: number; close: number }>; currency?: string }>;
      };
      const first = data.results?.[0];
      const points = (first?.historicalDataPrice || [])
        .filter((p) => p?.close > 0)
        .map((p) => ({ date: new Date(p.date * 1000).toISOString().slice(0, 10), close: p.close }));
      if (points.length) return { points, currency: first?.currency || 'BRL', source: 'brapi.dev' };
    }
    // Fallback gratuito (sem chave): Yahoo cobre EUA e mundo.
    const upper = symbol.toUpperCase();
    for (const candidate of [upper, `${upper}.SA`]) {
      try {
        return await this.yahooHistory(candidate, range);
      } catch {
        // tenta o próximo
      }
    }
    throw new NotFoundException(
      `Sem histórico para ${symbol} (brapi HTTP ${response.status}; Yahoo sem dados).`,
    );
  }

  private async yahooHistory(
    ticker: string,
    range: string,
  ): Promise<HistoryResult> {
    const interval = range === '5y' ? '1wk' : '1d';
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${range}&interval=${interval}`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36' },
    });
    if (!response.ok) throw new Error(`yahoo ${ticker}: HTTP ${response.status}`);
    const data = (await response.json()) as {
      chart?: {
        result?: Array<{
          meta?: { currency?: string };
          timestamp?: number[];
          indicators?: { quote?: Array<{ close?: Array<number | null> }> };
        }>;
      };
    };
    const result = data.chart?.result?.[0];
    const closes = result?.indicators?.quote?.[0]?.close || [];
    const stamps = result?.timestamp || [];
    const points: Array<{ date: string; close: number }> = [];
    for (let i = 0; i < stamps.length && i < closes.length; i += 1) {
      const close = closes[i];
      if (typeof close === 'number' && close > 0) {
        points.push({ date: new Date(stamps[i] * 1000).toISOString().slice(0, 10), close });
      }
    }
    if (!points.length) throw new Error(`yahoo ${ticker}: sem dados`);
    return { points, currency: result?.meta?.currency || 'USD', source: 'yahoo' };
  }

  async refreshPortfolioPrices(tenantId: string) {
    const portfolio = await this.portfolios.getDefaultPortfolio(tenantId);
    if (!portfolio) return { total: 0, updated: 0, failed: 0, quotes: [] };

    const positions = await this.prisma.position.findMany({
      where: { portfolioId: portfolio.id },
      include: { asset: true },
    });

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const quotes: Quote[] = [];
    const failures: Array<{ symbol: string; error: string }> = [];

    for (const position of positions) {
      try {
        const quote = await this.getQuote(position.asset.symbol, position.asset.type);
        await this.prisma.price.upsert({
          where: { assetId_date: { assetId: position.assetId, date: today } },
          create: {
            assetId: position.assetId,
            date: today,
            close: quote.price,
            source: quote.source,
          },
          update: { close: quote.price, source: quote.source, fetchedAt: new Date() },
        });
        quotes.push(quote);
      } catch (error) {
        failures.push({
          symbol: position.asset.symbol,
          error: error instanceof Error ? error.message : 'falha',
        });
      }
    }

    return {
      total: positions.length,
      updated: quotes.length,
      failed: failures.length,
      quotes,
      failures,
    };
  }

  private async b3Quote(symbol: string): Promise<Quote> {
    const token = process.env.BRAPI_TOKEN;
    const url = `https://brapi.dev/api/quote/${encodeURIComponent(symbol)}${token ? `?token=${token}` : ''}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`brapi ${symbol}: HTTP ${response.status}`);
    }
    const data = (await response.json()) as {
      results?: Array<{ regularMarketPrice?: number; currency?: string }>;
    };
    const result = data.results?.[0];
    if (!result?.regularMarketPrice) {
      throw new Error(`brapi ${symbol}: sem preço`);
    }
    return {
      symbol,
      price: result.regularMarketPrice,
      currency: result.currency || 'BRL',
      source: 'brapi.dev',
      fetchedAt: new Date().toISOString(),
    };
  }

  private async cryptoQuote(symbol: string): Promise<Quote> {
    const id = CRYPTO_IDS[symbol.toUpperCase()] || symbol.toLowerCase();
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=brl`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`CoinGecko ${symbol}: HTTP ${response.status}`);
    }
    const data = (await response.json()) as Record<string, { brl?: number }>;
    const price = data[id]?.brl;
    if (!price) {
      throw new Error(`CoinGecko ${symbol}: sem preço`);
    }
    return {
      symbol,
      price,
      currency: 'BRL',
      source: 'CoinGecko',
      fetchedAt: new Date().toISOString(),
    };
  }
}
