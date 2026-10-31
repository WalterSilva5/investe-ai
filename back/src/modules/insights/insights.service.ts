import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Insight } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AiProviderRegistry } from '../ai-provider/ai-provider.registry';
import { MacroService } from '../market/macro.service';
import { FxService } from '../market/fx.service';
import { PortfoliosService } from '../portfolios/portfolios.service';
import { MailService } from '../mail/mail.service';
import { NewsItem, NewsService } from './news.service';

const INSIGHT_PROMPT = `Você gera "insights" diários para um investidor pessoa física no Brasil.
Regras obrigatórias:
- Use APENAS os dados fornecidos no contexto. Nunca invente números.
- NÃO recomende compra ou venda, NÃO preveja preço, NÃO prometa retorno.
- Tom educacional; deixe claro que não é recomendação de investimento.
- Foque no que é acionável: o que observar, o que acompanhar, riscos e contexto.

Responda APENAS um JSON válido (sem markdown, sem comentários) com um array de 3 a 5 objetos:
[{"category":"MACRO|RENDA_FIXA|ACOES|CRIPTO|CARTEIRA","title":"...","content":"...","relatedSources":[0,2]}]
"relatedSources" são os índices (base 0) das notícias usadas no insight.`;

interface RawInsight {
  category?: string;
  title?: string;
  content?: string;
  relatedSources?: number[];
}

const CATEGORIES: Record<string, string> = {
  MACRO: 'MACRO',
  RENDA_FIXA: 'RENDA_FIXA',
  ACOES: 'ACOES',
  CRIPTO: 'CRIPTO',
  CARTEIRA: 'CARTEIRA',
  GERAL: 'GERAL',
};

@Injectable()
export class InsightsService {
  private readonly logger = new Logger(InsightsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: AiProviderRegistry,
    private readonly portfolios: PortfoliosService,
    private readonly macro: MacroService,
    private readonly fx: FxService,
    private readonly news: NewsService,
    private readonly mail: MailService,
  ) {}

  list(tenantId: string, category?: string) {
    return this.prisma.insight.findMany({
      where: {
        tenantId,
        ...(category ? { category } : {}),
      },
      orderBy: { generatedAt: 'desc' },
      take: 50,
    });
  }

  async unreadCount(tenantId: string) {
    const unread = await this.prisma.insight.count({
      where: { tenantId, isRead: false },
    });
    return { unread };
  }

  async markAllRead(tenantId: string) {
    const result = await this.prisma.insight.updateMany({
      where: { tenantId, isRead: false },
      data: { isRead: true },
    });
    return { updated: result.count };
  }

  async markRead(tenantId: string, id: string) {
    const insight = await this.prisma.insight.findFirst({ where: { id, tenantId } });
    if (!insight) throw new NotFoundException('Insight não encontrado.');
    return this.prisma.insight.update({ where: { id }, data: { isRead: true } });
  }

  async refresh(tenantId: string, notifyEmail = false) {
    const [macroData, internationalData, portfolioCtx, news] = await Promise.all([
      this.macro.getMacro(),
      this.fx.overview(),
      this.portfolios.aiContext(tenantId),
      this.news.headlines(12),
    ]);

    const context = {
      macro: macroData,
      international: internationalData,
      portfolio: portfolioCtx,
      news: news.map((item, index) => ({
        index,
        source: item.source,
        title: item.title,
      })),
    };

    const resolved = await this.registry.resolve(tenantId);
    const result = await resolved.provider.chat(
      [
        { role: 'system', content: INSIGHT_PROMPT },
        {
          role: 'user',
          content: `Contexto de hoje (${new Date().toISOString()}):\n${JSON.stringify(context)}`,
        },
      ],
      { model: resolved.model, temperature: 0.4, maxTokens: 1400 },
    );

    const raw = this.parseJson(result.content);
    if (!raw.length) {
      raw.push({
        category: 'GERAL',
        title: 'Insight do dia',
        content: result.content.slice(0, 1000),
      });
    }

    const created = await this.prisma.$transaction(
      raw.map((insight) =>
        this.prisma.insight.create({
          data: {
            tenantId,
            category: this.normalizeCategory(insight.category),
            title: (insight.title || 'Insight').slice(0, 140),
            content: (insight.content || '').slice(0, 2000),
            sources: this.mapSources(insight.relatedSources, news),
            providerId: resolved.providerId,
            model: resolved.model,
          },
        }),
      ),
    );

    let email: { sent: boolean; reason?: string } | undefined;
    if (notifyEmail) {
      email = await this.sendDigest(tenantId, created);
    }

    return {
      generated: created.length,
      providerId: resolved.providerId,
      model: resolved.model,
      ...(email ? { email } : {}),
    };
  }

  private async sendDigest(
    tenantId: string,
    insights: Insight[],
  ): Promise<{ sent: boolean; reason?: string }> {
    if (!insights.length) return { sent: false, reason: 'no-insights' };
    if (!this.mail.enabled) return { sent: false, reason: 'smtp-not-configured' };

    const members = await this.prisma.membership.findMany({
      where: { tenantId, role: { in: ['OWNER', 'ADMIN'] } },
      include: { user: { select: { email: true } } },
    });
    const emails = members.map((m) => m.user.email).filter(Boolean);
    if (!emails.length) return { sent: false, reason: 'no-recipients' };

    const text = insights
      .map((insight) => `[${insight.category}] ${insight.title}\n${insight.content}`)
      .join('\n\n---\n\n');

    return this.mail.send({
      to: emails.join(','),
      subject: 'wsi-invest-ai — novos insights de IA',
      text: `${text}\n\n(Conteúdo educacional — não é recomendação de investimento.)`,
    });
  }

  private mapSources(indexes: number[] | undefined, news: NewsItem[]) {
    if (!indexes?.length) return undefined;
    const sources = indexes
      .map((index) => news[index])
      .filter(Boolean)
      .map((item) => ({ title: item.title, url: item.url, source: item.source }));
    return sources.length ? sources : undefined;
  }

  private normalizeCategory(category: string | undefined): string {
    const key = String(category || '').toUpperCase().trim();
    return CATEGORIES[key] || 'GERAL';
  }

  private parseJson(content: string): RawInsight[] {
    try {
      const trimmed = content
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/```\s*$/, '')
        .trim();
      const start = trimmed.indexOf('[');
      const end = trimmed.lastIndexOf(']');
      if (start === -1 || end === -1 || end <= start) return [];
      const parsed = JSON.parse(trimmed.slice(start, end + 1));
      if (Array.isArray(parsed)) {
        return parsed.filter((item) => item && typeof item === 'object');
      }
      if (
        parsed &&
        typeof parsed === 'object' &&
        Array.isArray((parsed as { insights?: unknown[] }).insights)
      ) {
        return (parsed as { insights: RawInsight[] }).insights;
      }
      return [];
    } catch (error) {
      this.logger.warn(`Falha ao parsear insights: ${(error as Error).message}`);
      return [];
    }
  }
}
