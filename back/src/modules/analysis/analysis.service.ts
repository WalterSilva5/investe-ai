import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AiProviderRegistry } from '../ai-provider/ai-provider.registry';
import { PortfoliosService } from '../portfolios/portfolios.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ContributionDto, ProjectDto, RebalanceDto, RunwayDto } from './dto/analysis.dto';

const ADVICE_PROMPT = `Você é o assistente de aporte do dia de um investidor pessoa física no Brasil.
Recebe: valor do aporte de hoje, mapa de distribuição por tipo de ativo (calculado pelo rebalanceamento) e dicas recentes.
Regras:
- NÃO recomende compra ou venda de ativo específico, NÃO preveja preço, NÃO prometa retorno. Tom educacional.
- Comente o mapa: por que esses tipos foram priorizados (defasagem vs meta) e o que observar hoje (use as dicas).
- Seja curto e prático.

Responda APENAS um JSON válido (sem markdown): {"headline":"...","bullets":["...","..."],"watchOut":"..."}`;

export interface AdviceTip {
  headline?: string;
  bullets?: string[];
  watchOut?: string;
}

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(
    private readonly portfolios: PortfoliosService,
    private readonly prisma: PrismaService,
    private readonly registry: AiProviderRegistry,
  ) {}

  async runway(tenantId: string, dto: RunwayDto) {
    const summary = await this.portfolioSummary(tenantId);
    const rateAnnual = dto.rateAnnual ?? 12;
    const rateMonthly = rateAnnual / 100 / 12;
    const burn = dto.monthlyExpense - (dto.monthlyIncome ?? 0);

    let months: number;
    if (burn <= 0) {
      months = Number.POSITIVE_INFINITY;
    } else if (rateMonthly > 0) {
      months = -Math.log(1 - (rateMonthly * summary.totalValue) / burn) / Math.log(1 + rateMonthly);
    } else {
      months = summary.totalValue / burn;
    }

    return {
      assets: summary.totalValue,
      monthlyExpense: dto.monthlyExpense,
      monthlyIncome: dto.monthlyIncome ?? 0,
      burn,
      rateAnnual,
      months: Number.isFinite(months) ? Math.round(months * 10) / 10 : null,
      runwayYears: Number.isFinite(months) ? Math.round((months / 12) * 10) / 10 : null,
      infinite: !Number.isFinite(months),
    };
  }

  project(dto: ProjectDto) {
    const r = dto.rateAnnual / 100 / 12;
    const n = dto.months;
    const futureValue =
      dto.principal * Math.pow(1 + r, n) +
      (dto.monthlyContribution * (Math.pow(1 + r, n) - 1)) / (r || 1e-9);
    const invested = dto.principal + dto.monthlyContribution * n;
    return {
      futureValue,
      invested,
      interest: futureValue - invested,
      months: n,
      rateAnnual: dto.rateAnnual,
    };
  }

  async rebalance(tenantId: string, dto: RebalanceDto) {
    const { items, total } = await this.rebalanceItems(tenantId, dto.target);
    return { total, items };
  }

  /**
   * Mapa do aporte: distribui o valor de hoje entre os tipos de ativo,
   * priorizando quem está abaixo da meta (proporcional à defasagem).
   * Determinístico — não gasta tokens de IA.
   */
  async contributionMap(tenantId: string, dto: ContributionDto) {
    if (!dto.amount || dto.amount <= 0) {
      throw new BadRequestException('Informe um valor de aporte maior que zero.');
    }
    const { items, total } = await this.rebalance(tenantId, { target: dto.target });
    const eligible = items.filter((i) => (dto.target[i.type] ?? 0) > 0);
    if (!eligible.length) {
      throw new BadRequestException('Defina ao menos uma meta maior que zero.');
    }

    let weights = eligible.map((i) => Math.max(0, i.targetPct - i.currentPct));
    if (weights.every((w) => w === 0)) {
      weights = eligible.map((i) => dto.target[i.type]);
    }
    const sum = weights.reduce((a, b) => a + b, 0);

    const mapped = eligible.map((item, idx) => {
      const pct = sum > 0 ? (weights[idx] / sum) * 100 : 0;
      return {
        type: item.type,
        targetPct: item.targetPct,
        currentPct: item.currentPct,
        driftPct: item.driftPct,
        pct: Math.round(pct * 100) / 100,
        amount: Math.round(((pct / 100) * dto.amount) * 100) / 100,
      };
    });

    // Corrige centavos do arredondamento no maior item.
    const diff = Math.round((dto.amount - mapped.reduce((a, b) => a + b.amount, 0)) * 100) / 100;
    if (diff !== 0 && mapped.length) {
      const biggest = mapped.reduce((a, b) => (b.amount > a.amount ? b : a));
      biggest.amount = Math.round((biggest.amount + diff) * 100) / 100;
    }

    mapped.sort((a, b) => b.amount - a.amount);
    return { amount: dto.amount, portfolioTotal: total, items: mapped };
  }

  /**
   * Comentário do agente sobre o mapa (usa as dicas recentes).
   * Episódico — não é salvo, só gasta tokens quando solicitado.
   */
  async contributionAdvice(tenantId: string, dto: ContributionDto) {
    const map = await this.contributionMap(tenantId, dto);
    const tips = await this.prisma.insight.findMany({
      where: { tenantId },
      orderBy: { generatedAt: 'desc' },
      take: 6,
      select: { category: true, title: true, content: true },
    });

    const resolved = await this.registry.resolve(tenantId);
    const result = await resolved.provider.chat(
      [
        { role: 'system', content: ADVICE_PROMPT },
        {
          role: 'user',
          content: JSON.stringify({
            aporte: dto.amount,
            mapa: map.items,
            dicas: tips.map((t) => ({
              categoria: t.category,
              titulo: t.title,
              texto: t.content.slice(0, 300),
            })),
          }),
        },
      ],
      // Folga para o raciocínio do modelo não estourar o limite (vide insights).
      { model: resolved.model, temperature: 0.4, maxTokens: 2500 },
    );

    if (!result.content?.trim()) {
      this.logger.warn(
        `Provedor ${resolved.providerId}/${resolved.model} retornou conselho vazio (finishReason=${result.finishReason}).`,
      );
      throw new BadRequestException(
        'O provedor de IA retornou resposta vazia. Tente novamente ou troque o modelo em Provedores de IA.',
      );
    }

    return { map, advice: this.parseAdvice(result.content) };
  }

  private parseAdvice(content: string): AdviceTip & { raw?: string } {
    try {
      const trimmed = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
      const start = trimmed.indexOf('{');
      const end = trimmed.lastIndexOf('}');
      if (start === -1 || end <= start) return { raw: content.slice(0, 1500) };
      const parsed = JSON.parse(trimmed.slice(start, end + 1)) as AdviceTip;
      return {
        headline: String(parsed.headline || '').slice(0, 300),
        bullets: Array.isArray(parsed.bullets) ? parsed.bullets.map((b) => String(b).slice(0, 500)).slice(0, 6) : [],
        watchOut: String(parsed.watchOut || '').slice(0, 500),
      };
    } catch (error) {
      this.logger.warn(`Falha ao parsear conselho do aporte: ${(error as Error).message}`);
      return { raw: content.slice(0, 1500) };
    }
  }

  /**
   * Itens do rebalanceamento tolerando workspace sem carteira
   * (sem posições, tudo conta como 0% atual).
   */
  private async rebalanceItems(tenantId: string, target: Record<string, number>) {
    const summary = await this.portfolioSummary(tenantId);
    let currentByType = new Map<string, number>();
    let total = 0;
    if (summary.portfolio.id) {
      const allocation = await this.portfolios.allocation(tenantId, summary.portfolio.id);
      currentByType = new Map(allocation.byType.map((item) => [item.type, item.value]));
      total = allocation.total;
    }

    const items = Object.entries(target).map(([type, targetPct]) => {
      const currentValue = currentByType.get(type) ?? 0;
      const currentPct = total > 0 ? (currentValue / total) * 100 : 0;
      const targetValue = (targetPct / 100) * total;
      const drift = currentPct - targetPct;
      return {
        type,
        targetPct,
        currentPct: Math.round(currentPct * 100) / 100,
        currentValue,
        targetValue,
        driftPct: Math.round(drift * 100) / 100,
        move: targetValue - currentValue,
      };
    });

    return { items, total };
  }

  private async portfolioSummary(tenantId: string) {
    const portfolio = await this.portfolios.getDefaultPortfolio(tenantId);
    if (!portfolio) {
      return {
        portfolio: { id: '', name: '—', currency: 'BRL' },
        totalValue: 0,
        totalInvested: 0,
      };
    }
    return this.portfolios.summary(tenantId, portfolio.id);
  }
}
