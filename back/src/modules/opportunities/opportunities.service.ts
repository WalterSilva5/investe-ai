import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiProviderRegistry } from '../ai-provider/ai-provider.registry';
import { MacroService } from '../market/macro.service';
import { QuotesService } from '../market/quotes.service';
import { PortfoliosService } from '../portfolios/portfolios.service';
import { WhatIfService } from '../market/whatif.service';
import { LearningService } from '../learning/learning.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NewsService } from '../insights/news.service';
import {
  OPPORTUNITY_THEMES,
  OpportunityTheme,
  findOpportunityTheme,
} from './opportunity-themes';
import { buildThermometer } from './thermometer';
import { OPPORTUNITY_CYCLES } from './opportunity-cycles';
import { ContrarianInput, rankContrarian } from './contrarian';
import { DISCOVERY_UNIVERSE } from '../discovery/universe';

const BASE_PROMPT = `Você é um analista de narrativas e ciclos de mercado. Sua função é ajudar um investidor a ENTENDER uma "oportunidade" (tema/narrativa) e o estágio do ciclo — não a recomendar compra ou venda.

Regras obrigatórias (valem para todos os modos):
- NÃO recomende compra/venda, NÃO dê preço-alvo e NÃO preveja preço.
- NÃO sugira crime: manipulação, fraude, notícia falsa, pump-and-dump, insider trading ou golpe em pessoa específica (isso é ilegal, não "antiético").
- SIM aponte os erros da manada sem freio: pânico de vendedor fraco, euforia de comprador tarde, liquidação por margem, FOMO no topo — e como se posicionar DO LADO contrário para lucrar com isso. Tirar dinheiro dos erros alheios tomando o lado certo da negociação é o ofício do contrarionista: a mesma leitura que te protege do hype te mostra onde a manada deixou preço errado.
- Separe FATO de NARRATIVA. Seja cético com promessas.
- Classifique o estágio no ciclo de hype: EMERGENTE, HYPE, DESILUSAO, MATURACAO, PLATEAU, DECLINIO.
- Aponte sinais de confirmação, sinais de invalidação e regras de saída (disciplina), não "quando vender".
- Inclua riscos de manipulação, de comprar no topo e de baixa liquidez.
- Deixe claro que é conteúdo educacional, não recomendação.

Responda APENAS um JSON válido (sem markdown):
{
  "headline": "título curto",
  "stage": "EMERGENTE|HYPE|DESILUSAO|MATURACAO|PLATEAU|DECLINIO",
  "summary": "2-4 frases",
  "asymmetry": "upside vs downside em linguagem qualitativa (sem preço)",
  "evidence": ["..."],
  "risks": ["..."],
  "euphoriaSignals": ["..."],
  "confirmSignals": ["..."],
  "invalidateSignals": ["..."],
  "exitRules": ["..."],
  "sizing": ["framework de dimensionamento de risco (não é recomendação)"],
  "timing": "leitura de timing/janela (não é previsão)",
  "psychology": "como o hype/manipulação costuma funcionar neste tema",
  "disclaimer": "conteúdo educacional, não é recomendação"
}`;

const GROWTH_PROMPT = `Modo CRESCIMENTO MÁXIMO (agressivo, mas legal e disciplinado):
- Priorize ASSIMETRIA: onde o upside potencial é grande e o downside é limitado pelo tamanho da posição e pela disciplina de saída.
- Identifique o momento da narrativa: entrada cedo (emergente) × euforia (hype) × esfriamento/desilusão.
- Explique como NÃO ser o último comprador: sinais de topo (mídia mainstream, entrada massiva de leigos, promessas irreais, valuation esticado, atenção explodindo).
- Entregue um framework de dimensionamento de risco (ex.: risco por posição, teto por tema, stop de tese) e de saída (take profit parcial, trailing, invalidação).
- Foque em momentum, adoção real, fluxo de capital e catalisadores concretos.
- Aponte oportunidades de rotação de narrativa (o que está esfriando e o que está emergindo).
- NÃO recomende compra/venda nem dê alvo de preço; entregue leitura de cenário e regras.`;

const CONSERVATIVE_PROMPT = `Modo CONSERVADOR (preservação de capital):
- Priorize fundamentos, valuation, margem de segurança e risco de perda permanente.
- Seja cético com narrativas sem receita; destaque o que pode dar errado.
- Foque em proteção do capital e diversificação.`;

const CYCLE_PROMPT = `Você resume o CICLO ATUAL das narrativas de mercado a partir das análises de oportunidade mais recentes de cada tema.
Regras obrigatórias:
- NÃO recomende compra/venda, NÃO preveja preço, NÃO prometa retorno. Tom educacional.
- Sintetize: qual estágio domina (o mais representativo), quais temas puxam atenção, riscos transversais e o que observar nos próximos dias.
- Seja curto: summary em 3-5 frases, listas com até 5 itens.

Responda APENAS um JSON válido (sem markdown):
{
  "title": "título curto do momento",
  "summary": "...",
  "dominantStage": "EMERGENTE|HYPE|DESILUSAO|MATURACAO|PLATEAU|DECLINIO",
  "topThemes": [{"theme": "slug", "stage": "...", "note": "..."}],
  "risks": ["..."],
  "watchPoints": ["..."]
}`;

const ACTIONS_PROMPT = `Gere DICAS DE AÇÃO por ativo da carteira (até 6), cruzando posições, momentum de preço, radar e macro. Tom direto de conselheiro, sem hedge.
O campo "historicoDasRegras" traz a taxa de acerto medida das regras do próprio app: priorize as regras com melhor histórico e sinalize quando a amostra for pequena.
Ordene por prioridade e eleja 1 DESTAQUE DO DIA (o mais quente). Cada dica tem: verdict (Oportunidade | Aguardar | Evitar), trigger (o que confirmaria) e invalidation (o que quebra a leitura). Cada dica CITA NÚMEROS do contexto.
Linguagem de conselho, não de ordem: "faz sentido aumentar aos poucos", "não é hora de entrar", "realizar parcial é razoável" — evite o imperativo "compre/venda".
TEXTOS CURTOS: action até 12 palavras; signal/why/risk/trigger/invalidation até 10; summary 1 frase.
Responda SÓ o JSON (sem markdown): {"title":"...","summary":"...","actions":[{"ticker":"...","type":"...","signal":"...","action":"...","why":"...","risk":"...","verdict":"Oportunidade|Aguardar|Evitar","trigger":"...","invalidation":"...","highlight":true}] — só a 1ª com highlight:true}`;

const ACTIONS_THEMES_PROMPT = `Gere DICAS DE AÇÃO por tema do radar (até 6, sem posições em carteira). Tom direto de conselheiro, sem hedge. Cada dica tem verdict (Oportunidade | Aguardar | Evitar), trigger e invalidation, e cita NÚMEROS (atenção, tendência, hype). Ordene por prioridade e eleja 1 DESTAQUE DO DIA. Linguagem de conselho, não de ordem.
TEXTOS CURTOS: action até 12 palavras; signal/why/risk/trigger/invalidation até 10; summary 1 frase.
Responda SÓ o JSON (sem markdown): {"title":"...","summary":"...","actions":[{"theme":"...","signal":"...","action":"...","why":"...","risk":"...","verdict":"Oportunidade|Aguardar|Evitar","trigger":"...","invalidation":"...","highlight":true}] — só a 1ª com highlight:true}`;

function buildSystemPrompt(mode: string): string {
  return `${BASE_PROMPT}\n\n${mode === 'conservative' ? CONSERVATIVE_PROMPT : GROWTH_PROMPT}`;
}

interface CryptoMarket {
  symbol: string;
  price: number;
  change24h: number;
  change7d: number;
}

@Injectable()
export class OpportunitiesService {
  private readonly logger = new Logger(OpportunitiesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: AiProviderRegistry,
    private readonly macro: MacroService,
    private readonly news: NewsService,
    private readonly portfolios: PortfoliosService,
    private readonly quotes: QuotesService,
    private readonly learning: LearningService,
    private readonly notifications: NotificationsService,
    private readonly whatIf: WhatIfService,
  ) {}

  /** Cache de simulações por símbolo (12h) — evita refazer histórico a cada leitura. */
  private simCache = new Map<string, { at: number; data: Record<string, unknown> | null }>();
  private static readonly SIM_TTL_MS = 12 * 3600 * 1000;

  /**
   * Roda a simulação de estratégia (seguindo o agente, análise mensal) no
   * papel da oportunidade e devolve um bloco compacto para anexar à dica.
   */
  private async simulateFor(symbol: string, months = 24): Promise<Record<string, unknown> | null> {
    const key = `${symbol}:${months}`;
    const cached = this.simCache.get(key);
    if (cached && Date.now() - cached.at < OpportunitiesService.SIM_TTL_MS) return cached.data;
    try {
      const run = (await this.whatIf.strategy(symbol, 1000, months, 0)) as Record<string, unknown>;
      const agent = run.agent as Record<string, number | null>;
      const buyHold = run.buyHold as Record<string, number>;
      const cdi = run.cdi as Record<string, number> | null;
      const data = {
        months: run.months,
        invested: 1000,
        agentFinalValue: agent.finalValue,
        agentRoiPct: agent.roiPct,
        agentIrrAnnualPct: agent.irrAnnualPct,
        buyHoldFinalValue: buyHold.finalValue,
        buyHoldRoiPct: buyHold.roiPct,
        cdiFinalValue: cdi?.finalValue ?? null,
        anchors: agent.anchors,
        inMarketAnchors: agent.inMarketAnchors,
        verdict:
          (agent.roiPct ?? 0) > (buyHold.roiPct ?? 0)
            ? 'seguir o agente teria batido compra-e-segura'
            : 'compra-e-segura teria batido o agente',
      };
      this.simCache.set(key, { at: Date.now(), data });
      return data;
    } catch (error) {
      this.logger.warn(`Simulação para ${symbol} falhou: ${(error as Error).message.slice(0, 80)}`);
      this.simCache.set(key, { at: Date.now(), data: null });
      return null;
    }
  }

  /** Anexa a simulação às dicas que têm ticker (em paralelo, limitado). */
  private async enrichTipsWithSimulations(
    actions: Array<Record<string, unknown>>,
  ): Promise<Array<Record<string, unknown>>> {
    const tickers = [...new Set(
      actions
        .filter((tip) => tip.ticker && tip.verdict)
        .map((tip) => String(tip.ticker).toUpperCase()),
    )];
    if (!tickers.length) return actions;
    const sims = new Map<string, Record<string, unknown> | null>();
    const CONCURRENCY = 3;
    for (let i = 0; i < tickers.length; i += CONCURRENCY) {
      await Promise.all(
        tickers.slice(i, i + CONCURRENCY).map(async (ticker) => {
          sims.set(ticker, await this.simulateFor(ticker));
        }),
      );
    }
    return actions.map((tip) => {
      const sim = tip.ticker ? sims.get(String(tip.ticker).toUpperCase()) : undefined;
      return sim ? { ...tip, simulation: sim } : tip;
    });
  }

  themes() {
    return OPPORTUNITY_THEMES.map((theme) => ({
      slug: theme.slug,
      name: theme.name,
      icon: theme.icon,
      description: theme.description,
      questions: theme.questions,
    }));
  }

  cycles() {
    return OPPORTUNITY_CYCLES;
  }

  list(tenantId: string, theme?: string) {
    return this.prisma.opportunityBrief.findMany({
      where: { tenantId, ...(theme ? { theme } : {}) },
      orderBy: { generatedAt: 'desc' },
      take: 50,
    });
  }

  /** Resumo mais recente do ciclo atual (gerado periodicamente). */
  currentCycle(tenantId: string) {
    return this.prisma.cycleSummary.findFirst({
      where: { tenantId },
      orderBy: { generatedAt: 'desc' },
    });
  }

  /**
   * (Re)gera o resumo do ciclo atual a partir das análises mais recentes
   * de cada tema + atenção do radar. Manual ou via cron semanal.
   */
  async refreshCycle(tenantId: string) {
    const briefs = await this.prisma.opportunityBrief.findMany({
      where: { tenantId },
      orderBy: { generatedAt: 'desc' },
      take: 100,
    });
    if (!briefs.length) {
      throw new NotFoundException('Analise ao menos um tema para gerar o resumo do ciclo.');
    }
    const latestByTheme = new Map<string, (typeof briefs)[number]>();
    for (const brief of briefs) {
      if (!latestByTheme.has(`${brief.theme}:${brief.mode}`)) {
        latestByTheme.set(`${brief.theme}:${brief.mode}`, brief);
      }
    }
    const latest = [...latestByTheme.values()].slice(0, 18);

    const resolved = await this.registry.resolve(tenantId);
    const result = await resolved.provider.chat(
      [
        { role: 'system', content: CYCLE_PROMPT },
        {
          role: 'user',
          content: JSON.stringify(
            latest.map((b) => ({
              tema: b.theme,
              modo: b.mode,
              titulo: b.title,
              estagio: b.stage,
              atencao: b.attention,
              hype: b.hypeRisk,
              resumo: typeof b.content === 'object' && b.content !== null
                ? String((b.content as Record<string, unknown>)['summary'] || '').slice(0, 500)
                : '',
            })),
          ),
        },
      ],
      { model: resolved.model, temperature: 0.4, maxTokens: 1500 },
    );

    const parsed = this.parseCycleJson(result.content);
    if (!parsed.summary) {
      if (!result.content?.trim()) {
        this.logger.warn('Provedor retornou resumo do ciclo vazio.');
        throw new NotFoundException('O provedor retornou resposta vazia. Tente novamente.');
      }
      parsed.summary = result.content.slice(0, 1500);
      parsed.title = parsed.title || 'Resumo do ciclo atual';
    }

    const created = await this.prisma.cycleSummary.create({
      data: {
        tenantId,
        title: String(parsed.title || 'Resumo do ciclo atual').slice(0, 180),
        summary: String(parsed.summary || '').slice(0, 3000),
        dominantStage: this.normalizeStage(parsed.dominantStage),
        topThemes: (parsed.topThemes || []) as never,
        risks: (parsed.risks || []) as never,
        watchPoints: (parsed.watchPoints || []) as never,
        providerId: resolved.providerId,
        model: resolved.model,
      },
    });

    // Retenção: mantém os 6 resumos mais recentes.
    const keep = await this.prisma.cycleSummary.findMany({
      where: { tenantId },
      orderBy: { generatedAt: 'desc' },
      take: 6,
      select: { id: true },
    });
    await this.prisma.cycleSummary.deleteMany({
      where: { tenantId, id: { notIn: keep.map((k) => k.id) } },
    });

    return created;
  }

  /** Último digest de dicas de ação (gerado manual ou via cron). */
  latestActions(tenantId: string) {
    return this.prisma.actionDigest.findFirst({
      where: { tenantId },
      orderBy: { generatedAt: 'desc' },
    });
  }

  /** Dicas atuais COM simulações (enriquece sob demanda e salva de volta quando faltava). */
  async latestActionsEnriched(tenantId: string) {
    const digest = await this.latestActions(tenantId);
    if (!digest) return digest;
    const actions = digest.actions as unknown as Array<Record<string, unknown>>;
    if (!Array.isArray(actions) || !actions.length) return digest;
    const needsSim = actions.some((tip) => tip.ticker && !tip.simulation);
    if (!needsSim) return digest;
    const enriched = await this.enrichTipsWithSimulations(actions);
    const updated = { ...digest, actions: enriched as never };
    // Persiste o enriquecimento para não refazer a cada leitura.
    await this.prisma.actionDigest
      .update({ where: { id: digest.id }, data: { actions: enriched as never } })
      .catch(() => undefined);
    return updated;
  }

  /**
   * Radar contrário: papéis que caíram e mostram sinal de virada
   * (sobrevenda, suporte próximo, ganho/risco e repique). Varre o mesmo
   * universo da descoberta + posições da carteira.
   */
  async contrarian(tenantId: string, limit = 8) {
    const portfolio = await this.portfolios.getDefaultPortfolio(tenantId);
    const positions = portfolio
      ? await this.portfolios.positions(tenantId, portfolio.id).catch(() => [])
      : [];
    const symbols = new Set<string>([
      ...DISCOVERY_UNIVERSE.map((item) => item.symbol),
      ...positions.map((pos) => pos.symbol),
    ]);
    const list = [...symbols];

    const inputs: ContrarianInput[] = [];
    const failures: string[] = [];
    const CONCURRENCY = 4;
    for (let i = 0; i < list.length; i += CONCURRENCY) {
      const chunk = list.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        chunk.map(async (symbol) => {
          try {
            const outlook = await this.quotes.outlook(symbol, '1y');
            return { symbol, outlook };
          } catch {
            return { symbol, outlook: null };
          }
        }),
      );
      for (const result of results) {
        if (!result.outlook) {
          failures.push(result.symbol);
          continue;
        }
        const o = result.outlook;
        inputs.push({
          symbol: o.symbol,
          technicalScore: o.read.score,
          trend: o.read.trend,
          rsi: o.read.rsi14,
          ratio: o.read.ratio,
          change1d: o.read.dayChange,
          change1m: o.read.monthChange,
          change3m: o.read.quarterChange,
          distSupportPct: o.read.downsidePct,
          aboveMa20: o.read.ma20 != null && o.current >= o.read.ma20,
        });
      }
    }

    const ranked = rankContrarian(inputs, limit);
    const items = ranked.map((item) => {
      const outlook = inputs.find((input) => input.symbol === item.symbol);
      return {
        ...item,
        drop3mPct: outlook?.change3m ?? null,
        rsi14: outlook?.rsi ?? null,
        distSupportPct: outlook?.distSupportPct ?? null,
        ratio: outlook?.ratio ?? null,
      };
    });

    // Simulação "seguindo o agente" em cada item do radar contrário.
    const simResults = new Map<string, Record<string, unknown> | null>();
    const contrarianSymbols = items.map((item) => item.symbol).slice(0, 8);
    for (let i = 0; i < contrarianSymbols.length; i += 3) {
      await Promise.all(
        contrarianSymbols.slice(i, i + 3).map(async (symbol) => {
          simResults.set(symbol, await this.simulateFor(symbol));
        }),
      );
    }
    const itemsWithSim = items.map((item) => {
      const sim = simResults.get(item.symbol);
      return sim ? { ...item, simulation: sim } : item;
    });

    // Sinal quente: reversão forte com nota alta vira notificação (dedupe por dia).
    for (const item of itemsWithSim
      .filter((item) => item.verdict === 'Reversão forte' && item.score >= 70)
      .slice(0, 3)) {
      await this.notifications
        .notify(tenantId, {
          kind: 'hot-reversal',
          title: `🔥 Reversão forte em ${item.symbol} (nota ${item.score}/100)`,
          body: item.reasons.join(' · ') + '. Papel que caiu e dá sinal de virada — revisar no Tracking.',
          url: '/app/opportunities',
          dedupeKey: `contrarian:${item.symbol}`,
        })
        .catch(() => undefined);
    }

    return { scanned: inputs.length, failures, items: itemsWithSim };
  }

  /** Histórico por dia: digest de cada geração (título, data e ações). */
  actionsHistory(tenantId: string, take = 30) {
    return this.prisma.actionDigest.findMany({
      where: { tenantId },
      orderBy: { generatedAt: 'desc' },
      take: Math.min(Math.max(take, 1), 60),
    });
  }

  /**
   * Gera dicas de ação por ativo da carteira (com contexto do radar + macro).
   * Sem posições: usa os temas do radar. Manual ou via cron.
   */
  async refreshActions(tenantId: string) {
    const [items, macro, portfolio] = await Promise.all([
      this.radar(tenantId, 'growth'),
      this.macro.getMacro().catch(() => null),
      this.portfolios.getDefaultPortfolio(tenantId),
    ]);
    const positions = portfolio
      ? await this.portfolios.positions(tenantId, portfolio.id).catch(() => [])
      : [];
    // Momentum (3m) dos maiores pesos para as dicas citarem números reais.
    const top = [...positions].sort((a, b) => b.currentValue - a.currentValue).slice(0, 5);
    const momentums = await Promise.all(
      top.map(async (pos) => {
        try {
          const lv = await this.quotes.levels(pos.symbol, '3mo');
          const nearest = lv.supports[0];
          return {
            symbol: pos.symbol,
            change3m: lv.changePct,
            vsMA50: lv.ma50 != null ? Math.round(((lv.current - lv.ma50) / lv.ma50) * 10000) / 100 : null,
            distSupportPct:
              nearest != null && lv.current > 0
                ? Math.round(((lv.current - nearest) / lv.current) * 10000) / 100
                : null,
          };
        } catch {
          return { symbol: pos.symbol, change3m: null, vsMA50: null, distSupportPct: null };
        }
      }),
    );
    const momentumBySymbol = new Map(momentums.map((m) => [m.symbol, m]));
    const withSignal = items.filter((i) => i.attention > 0 || i.latest || (i.trend ?? 0) !== 0);
    if (!positions.length && !withSignal.length) {
      throw new NotFoundException('Sem carteira nem movimento no radar para gerar dicas.');
    }

    const resolved = await this.registry.resolve(tenantId);
    const learningStats = await this.learning.promptStats(tenantId).catch(() => null);
    const userContent = JSON.stringify({
      macro,
      historicoDasRegras: learningStats,
      posicoes: positions.slice(0, 20).map((pos) => {
        const mom = momentumBySymbol.get(pos.symbol);
        return {
          ticker: pos.symbol,
          tipo: pos.type,
          qtd: pos.quantity,
          precoMedio: pos.averagePrice,
          valorAtual: pos.currentValue,
          resultadoPct: Math.round(pos.pnlPct * 100) / 100,
          variacao3mPct: mom?.change3m ?? null,
          vsMM50Pct: mom?.vsMA50 ?? null,
          distanciaSuportePct: mom?.distSupportPct ?? null,
        };
      }),
      radar: withSignal.slice(0, 14).map((i) => ({
        tema: i.slug,
        atencao: i.attention,
        tendencia: i.trend ?? 0,
        estagio: i.latest?.stage || null,
        hype: i.latest?.hypeRisk ?? null,
        manchete: i.headlines[0]?.title || null,
      })),
    });
    // O provedor às vezes devolve conteúdo vazio: tenta de novo 1x antes de falhar.
    let result: { content?: string | null } | null = null;
    const systemPrompt = positions.length ? ACTIONS_PROMPT : ACTIONS_THEMES_PROMPT;
    for (let attempt = 0; attempt < 2 && !result?.content?.trim(); attempt += 1) {
      if (attempt > 0) this.logger.warn(`Dicas de ação: repetindo chamada vazia (tentativa ${attempt + 1}).`);
      result = await resolved.provider.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        { model: resolved.model, temperature: 0.4, maxTokens: 6000 },
      );
    }

    const content = result?.content || '';
    if (!content.trim()) {
      this.logger.warn('Provedor retornou dicas de ação vazias (2 tentativas).');
      throw new NotFoundException('O provedor retornou resposta vazia. Tente novamente.');
    }
    const parsed = this.parseCycleJson(content);
    let actions = Array.isArray(parsed.actions) ? parsed.actions : [];
    if (!actions.length) {
      this.logger.warn(
        `Dicas de ação: parse total falhou (len=${content.length}). Head: ${content.slice(0, 200).replace(/\s+/g, ' ')}`,
      );
      // JSON truncado/inválido: extrai os textos de "action" mesmo assim.
      actions = this.extractActionTexts(content).map((action) => ({
        theme: 'geral',
        signal: 'resumo',
        action,
        why: '',
        risk: '',
      }));
    }
    if (!actions.length) {
      if (!content.trim()) {
        this.logger.warn('Provedor retornou dicas de ação vazias (2 tentativas).');
        throw new NotFoundException('O provedor retornou resposta vazia. Tente novamente.');
      }
      this.logger.warn('Dicas de ação sem estrutura aproveitável; salvando resumo textual.');
      const fallbackText = String(parsed.summary || '').trim() || this.stripJson(content).slice(0, 800);
      actions.push({ theme: 'geral', signal: 'resumo', action: fallbackText, why: '', risk: '' });
    }

    const created = await this.prisma.actionDigest.create({
      data: {
        tenantId,
        title: String(parsed.title || 'Dicas de ação').slice(0, 180),
        summary: String(parsed.summary || '').slice(0, 1500),
        actions: (await this.enrichTipsWithSimulations(
          actions.slice(0, 6).map((a, i) => ({ ...a, highlight: i === 0 })),
        )) as never,
        providerId: resolved.providerId,
        model: resolved.model,
      },
    });

    const keep = await this.prisma.actionDigest.findMany({
      where: { tenantId },
      orderBy: { generatedAt: 'desc' },
      take: 30,
      select: { id: true },
    });
    await this.prisma.actionDigest.deleteMany({
      where: { tenantId, id: { notIn: keep.map((k) => k.id) } },
    });

    // Dicas "quentes": veredito Oportunidade vira notificação (destaque e demais).
    for (const tip of actions
      .filter((tip) => tip.verdict === 'Oportunidade')
      .slice(0, 3)) {
      const subject = tip.ticker || tip.theme || 'mercado';
      await this.notifications
        .notify(tenantId, {
          kind: 'hot-tip',
          title: `🔥 Oportunidade: ${subject}`,
          body: `${tip.action || ''}. Sinal: ${tip.signal || ''}. ${tip.risk ? `Risco: ${tip.risk}` : ''}`.trim(),
          url: '/app/opportunities',
          dedupeKey: `tip:${subject}`,
        })
        .catch(() => undefined);
    }

    return created;
  }

  async radar(tenantId: string, mode?: string) {
    const normalizedMode = mode === 'conservative' ? 'conservative' : 'growth';
    const [headlines, briefs] = await Promise.all([
      this.news.headlines(40),
      this.prisma.opportunityBrief.findMany({
        where: { tenantId, mode: normalizedMode },
        orderBy: { generatedAt: 'desc' },
        take: 100,
      }),
    ]);

    const latestByTheme = new Map<string, (typeof briefs)[number]>();
    for (const brief of briefs) {
      if (!latestByTheme.has(brief.theme)) latestByTheme.set(brief.theme, brief);
    }

    await this.recordSnapshots(
      OPPORTUNITY_THEMES.map((theme) => ({
        slug: theme.slug,
        attention: headlines.filter((headline) => this.matchesTheme(headline.title, theme)).length,
      })),
    );
    const trends = await this.trends();

    const items = OPPORTUNITY_THEMES.map((theme) => {
      const matches = headlines.filter((headline) => this.matchesTheme(headline.title, theme));
      const latest = latestByTheme.get(theme.slug);
      return {
        slug: theme.slug,
        name: theme.name,
        icon: theme.icon,
        description: theme.description,
        attention: matches.length,
        trend: trends[theme.slug] ?? 0,
        headlines: matches.slice(0, 5).map((headline) => ({
          title: headline.title,
          source: headline.source,
          url: headline.url,
        })),
        thermometer: buildThermometer({
          attention: matches.length,
          trend: trends[theme.slug] ?? 0,
          stage: latest?.stage,
          hypeRisk: latest?.hypeRisk,
        }),
        latest: latest
          ? {
              id: latest.id,
              title: latest.title,
              stage: latest.stage,
              mode: latest.mode,
              attention: latest.attention,
              hypeRisk: latest.hypeRisk,
              generatedAt: latest.generatedAt,
            }
          : null,
      };
    });

    return items;
  }

  /** Registra um snapshot por dia (atenção global de notícias). */
  private async recordSnapshots(items: Array<{ slug: string; attention: number }>) {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const existing = await this.prisma.opportunitySnapshot.findFirst({
      where: { capturedAt: { gte: startOfDay } },
    });
    if (existing) return;
    await this.prisma.opportunitySnapshot.createMany({
      data: items.map((item) => ({ theme: item.slug, attention: item.attention })),
    });
  }

  /** Tendência de atenção: diferença entre o primeiro e o último snapshot (7 dias). */
  private async trends(): Promise<Record<string, number>> {
    const since = new Date(Date.now() - 7 * 86_400_000);
    const snapshots = await this.prisma.opportunitySnapshot.findMany({
      where: { capturedAt: { gte: since } },
      orderBy: { capturedAt: 'asc' },
    });
    const byTheme = new Map<string, { first: number; last: number }>();
    for (const snapshot of snapshots) {
      const entry = byTheme.get(snapshot.theme);
      if (!entry) {
        byTheme.set(snapshot.theme, { first: snapshot.attention, last: snapshot.attention });
      } else {
        entry.last = snapshot.attention;
      }
    }
    const result: Record<string, number> = {};
    for (const [theme, value] of byTheme) result[theme] = value.last - value.first;
    return result;
  }

  async analyze(tenantId: string, themeSlug: string, mode = 'growth') {
    const theme = findOpportunityTheme(themeSlug);
    if (!theme) throw new NotFoundException('Tema não encontrado.');
    const normalizedMode = mode === 'conservative' ? 'conservative' : 'growth';

    const [headlines, macro, crypto] = await Promise.all([
      this.news.headlines(40),
      this.macro.getMacro(),
      this.cryptoMarket(theme),
    ]);
    const matches = headlines.filter((headline) => this.matchesTheme(headline.title, theme));
    const attention = matches.length;
    const hypeRisk = this.hypeRisk(attention, crypto);

    const resolved = await this.registry.resolve(tenantId);
    // O provedor às vezes devolve vazio/truncado: até 2 tentativas + orçamento
    // folgado (o raciocínio consome tokens antes do JSON).
    let result: { content?: string | null } | null = null;
    for (let attempt = 0; attempt < 2 && !result?.content?.trim(); attempt += 1) {
      if (attempt > 0) this.logger.warn(`Análise ${theme.slug}: repetindo resposta vazia (tentativa ${attempt + 1}).`);
      result = await resolved.provider.chat(
        [
          { role: 'system', content: buildSystemPrompt(normalizedMode) },
          {
            role: 'user',
            content: [
              `Tema: ${theme.name}`,
              `Descrição: ${theme.description}`,
              `Perguntas-guia: ${theme.questions.join(' | ')}`,
              `Manchetes relacionadas (${matches.length}):`,
              matches.map((headline) => `- [${headline.source}] ${headline.title}`).join('\n') ||
                '(nenhuma manchete no momento)',
              `Dados de mercado: ${JSON.stringify(crypto)}`,
              `Macro: ${JSON.stringify(macro)}`,
            ].join('\n'),
          },
        ],
        { model: resolved.model, temperature: 0.4, maxTokens: 6000 },
      );
    }

    const parsed = this.parseJson(result?.content || '');
    const brief = await this.prisma.opportunityBrief.create({
      data: {
        tenantId,
        theme: theme.slug,
        title: String(parsed.headline || theme.name).slice(0, 180),
        stage: this.normalizeStage(parsed.stage),
        mode: normalizedMode,
        attention,
        hypeRisk,
        content: parsed as never,
        sources: matches.slice(0, 8).map((headline) => ({
          title: headline.title,
          source: headline.source,
          url: headline.url,
        })) as never,
        providerId: resolved.providerId,
        model: resolved.model,
      },
    });

    return brief;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private matchesTheme(title: string, theme: OpportunityTheme): boolean {
    const normalized = this.normalize(title);
    return theme.keywords.some((keyword) => {
      const key = this.normalize(keyword).trim();
      if (!key) return false;
      if (key.length <= 3) {
        return new RegExp(`\\b${key}\\b`).test(normalized);
      }
      return normalized.includes(key);
    });
  }

  private normalize(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private hypeRisk(attention: number, crypto: CryptoMarket[] | null): number {
    let risk = Math.min(45, attention * 5);
    if (crypto?.length) {
      const change24h = Math.max(...crypto.map((item) => Math.abs(item.change24h || 0)));
      const change7d = Math.max(...crypto.map((item) => Math.abs(item.change7d || 0)));
      risk += Math.min(30, change24h * 1.5);
      risk += Math.min(25, change7d / 2);
    } else {
      risk += Math.min(25, attention * 3);
    }
    return Math.min(100, Math.round(risk));
  }

  private async cryptoMarket(theme: OpportunityTheme): Promise<CryptoMarket[] | null> {
    if (!theme.cryptoIds?.length) return null;
    try {
      const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${theme.cryptoIds.join(
        ',',
      )}&price_change_percentage=24h,7d`;
      const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as Array<{
        symbol: string;
        current_price: number;
        price_change_percentage_24h: number;
        price_change_percentage_7d_in_currency: number;
      }>;
      return data.map((item) => ({
        symbol: item.symbol.toUpperCase(),
        price: item.current_price,
        change24h: item.price_change_percentage_24h,
        change7d: item.price_change_percentage_7d_in_currency,
      }));
    } catch (error) {
      this.logger.warn(`CoinGecko (oportunidades) falhou: ${(error as Error).message}`);
      return null;
    }
  }

  private normalizeStage(stage: unknown): string {
    const value = String(stage || '').toUpperCase().trim();
    const allowed = ['EMERGENTE', 'HYPE', 'DESILUSAO', 'MATURACAO', 'PLATEAU', 'DECLINIO'];
    return allowed.includes(value) ? value : 'EMERGENTE';
  }

  /** Extrai valores de "action" mesmo de JSON truncado/inválido. */
  private extractActionTexts(content: string): string[] {
    const out: string[] = [];
    const re = /"action"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null && out.length < 6) {
      const text = m[1].replace(/\\"/g, '"').replace(/\\n/g, ' ').trim();
      if (text) out.push(text.slice(0, 400));
    }
    return out;
  }

  /** Remove sintaxe JSON para exibir texto legível no último recurso. */
  private stripJson(content: string): string {
    return content
      .replace(/```(?:json)?/gi, '')
      .replace(/[{}[\]"]/g, ' ')
      .replace(/\\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private parseCycleJson(content: string): Record<string, any> {    const repair = (text: string): string => {
      let out = '';
      let inStr = false;
      let esc = false;
      for (const ch of text) {
        if (esc) {
          out += ch;
          esc = false;
          continue;
        }
        if (ch === '\\') {
          out += ch;
          if (inStr) esc = true;
          continue;
        }
        if (ch === '"') {
          inStr = !inStr;
          out += ch;
          continue;
        }
        if (inStr && ch < ' ') {
          out += ' ';
          continue;
        }
        out += ch;
      }
      return out.replace(/,(\s*[}\]])/g, '$1');
    };
    const attempt = (text: string): Record<string, any> | null => {
      try {
        const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
        const start = trimmed.indexOf('{');
        const end = trimmed.lastIndexOf('}');
        if (start === -1 || end <= start) return null;
        const parsed = JSON.parse(trimmed.slice(start, end + 1)) as unknown;
        return parsed && typeof parsed === 'object' ? (parsed as Record<string, any>) : null;
      } catch {
        return null;
      }
    };
    return attempt(content) ?? attempt(repair(content)) ?? {};
  }

  /** Parse tolerante: repara quebras literais/vírgulas finais (mesma técnica dos insights). */
  private parseJson(content: string): Record<string, unknown> {
    const attempt = (text: string): Record<string, unknown> | null => {
      try {
        const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
        const start = trimmed.indexOf('{');
        const end = trimmed.lastIndexOf('}');
        if (start === -1 || end <= start) return null;
        const parsed = JSON.parse(trimmed.slice(start, end + 1)) as unknown;
        return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
      } catch {
        return null;
      }
    };
    const repair = (text: string): string => {
      let out = '';
      let inStr = false;
      let esc = false;
      for (const ch of text) {
        if (esc) {
          out += ch;
          esc = false;
          continue;
        }
        if (ch === '\\') {
          out += ch;
          if (inStr) esc = true;
          continue;
        }
        if (ch === '"') {
          inStr = !inStr;
          out += ch;
          continue;
        }
        if (inStr && ch < ' ') {
          out += ' ';
          continue;
        }
        out += ch;
      }
      return out.replace(/,(\s*[}\]])/g, '$1');
    };
    const raw = content || '';
    return attempt(raw) ?? attempt(repair(raw)) ?? {};
  }
}
