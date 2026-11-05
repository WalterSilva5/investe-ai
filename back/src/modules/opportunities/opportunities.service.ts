import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiProviderRegistry } from '../ai-provider/ai-provider.registry';
import { MacroService } from '../market/macro.service';
import { NewsService } from '../insights/news.service';
import {
  OPPORTUNITY_THEMES,
  OpportunityTheme,
  findOpportunityTheme,
} from './opportunity-themes';

const BASE_PROMPT = `Você é um analista de narrativas e ciclos de mercado. Sua função é ajudar um investidor a ENTENDER uma "oportunidade" (tema/narrativa) e o estágio do ciclo — não a recomendar compra ou venda.

Regras obrigatórias (valem para todos os modos):
- NÃO recomende compra/venda, NÃO dê preço-alvo e NÃO preveja preço.
- NÃO sugira manipulação, fraude, notícia falsa, pump-and-dump, insider trading ou explorar pessoas específicas. O foco é o investidor agir com ética e se proteger.
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
  ) {}

  themes() {
    return OPPORTUNITY_THEMES.map((theme) => ({
      slug: theme.slug,
      name: theme.name,
      icon: theme.icon,
      description: theme.description,
      questions: theme.questions,
    }));
  }

  list(tenantId: string, theme?: string) {
    return this.prisma.opportunityBrief.findMany({
      where: { tenantId, ...(theme ? { theme } : {}) },
      orderBy: { generatedAt: 'desc' },
      take: 50,
    });
  }

  async radar(tenantId: string) {
    const [headlines, briefs] = await Promise.all([
      this.news.headlines(40),
      this.prisma.opportunityBrief.findMany({
        where: { tenantId },
        orderBy: { generatedAt: 'desc' },
        take: 100,
      }),
    ]);

    const latestByTheme = new Map<string, (typeof briefs)[number]>();
    for (const brief of briefs) {
      if (!latestByTheme.has(brief.theme)) latestByTheme.set(brief.theme, brief);
    }

    return OPPORTUNITY_THEMES.map((theme) => {
      const matches = headlines.filter((headline) => this.matchesTheme(headline.title, theme));
      const latest = latestByTheme.get(theme.slug);
      return {
        slug: theme.slug,
        name: theme.name,
        icon: theme.icon,
        description: theme.description,
        attention: matches.length,
        headlines: matches.slice(0, 5).map((headline) => ({
          title: headline.title,
          source: headline.source,
          url: headline.url,
        })),
        latest: latest
          ? {
              id: latest.id,
              title: latest.title,
              stage: latest.stage,
              attention: latest.attention,
              hypeRisk: latest.hypeRisk,
              generatedAt: latest.generatedAt,
            }
          : null,
      };
    });
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
    const result = await resolved.provider.chat(
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
      { model: resolved.model, temperature: 0.4, maxTokens: 1800 },
    );

    const parsed = this.parseJson(result.content);
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

  private parseJson(content: string): Record<string, unknown> {
    try {
      const trimmed = content
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/```\s*$/, '')
        .trim();
      const start = trimmed.indexOf('{');
      const end = trimmed.lastIndexOf('}');
      if (start === -1 || end === -1 || end <= start) return {};
      const parsed = JSON.parse(trimmed.slice(start, end + 1));
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch (error) {
      this.logger.warn(`Falha ao parsear análise de oportunidade: ${(error as Error).message}`);
      return {};
    }
  }
}
