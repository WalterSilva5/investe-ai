import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { AlertsService } from '../alerts/alerts.service';
import { QuotesService } from '../market/quotes.service';
import { InsightsService } from '../insights/insights.service';
import { LearningService } from '../learning/learning.service';
import { DiscoveryService } from '../discovery/discovery.service';
import { PromptTuneService } from '../ai/prompt-tune.service';
import { OpportunitiesService } from '../opportunities/opportunities.service';
import { PaperService } from '../paper/paper.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly quotes: QuotesService,
    private readonly alerts: AlertsService,
    private readonly insights: InsightsService,
    private readonly opportunities: OpportunitiesService,
    private readonly learning: LearningService,
    private readonly discovery: DiscoveryService,
    private readonly promptTune: PromptTuneService,
    private readonly paper: PaperService,
  ) {}

  /** Dias úteis, 18h (horário do servidor). */
  @Cron('0 18 * * 1-5')
  async syncAll(): Promise<void> {
    if (process.env.ENABLE_CRON === 'false') return;

    const tenants = await this.prisma.tenant.findMany({
      where: { portfolios: { some: {} } },
      select: { id: true },
    });

    for (const tenant of tenants) {
      try {
        const result = await this.quotes.refreshPortfolioPrices(tenant.id);
        this.logger.log(
          `Cotações ${tenant.id}: ${result.updated}/${result.total} atualizadas.`,
        );
      } catch (error) {
        this.logger.warn(
          `Falha ao atualizar cotações ${tenant.id}: ${(error as Error).message}`,
        );
      }
      try {
        const result = await this.alerts.evaluate(tenant.id);
        if (result.triggered) {
          this.logger.log(`Alertas ${tenant.id}: ${result.triggered} disparado(s).`);
        }
      } catch (error) {
        this.logger.warn(`Falha ao avaliar alertas ${tenant.id}: ${(error as Error).message}`);
      }
    }
  }

  /** Dias úteis, 8h — gera insights de IA (notícias + macro + carteira). */
  @Cron('0 8 * * 1-5')
  async generateInsights(): Promise<void> {
    if (process.env.ENABLE_CRON === 'false') return;

    const hasEnvOpenCode = Boolean(process.env.OPENCODE_API_KEY);
    const tenants = await this.prisma.tenant.findMany({
      where: hasEnvOpenCode ? {} : { credentials: { some: { enabled: true } } },
      select: { id: true },
    });

    for (const tenant of tenants) {
      try {
        const result = await this.insights.refresh(tenant.id, true);
        const email = (result as { email?: { sent: boolean; reason?: string } }).email;
        this.logger.log(
          `Insights ${tenant.id}: ${result.generated} gerado(s)` +
            (email ? ` · e-mail ${email.sent ? 'enviado' : `ignorado (${email.reason})`}` : ''),
        );
      } catch (error) {
        this.logger.warn(`Falha ao gerar insights ${tenant.id}: ${(error as Error).message}`);
      }
    }
  }

  /** Segunda 7h — SWARM: auto-ajuste para todos os perfis em paralelo. */
  @Cron('0 7 * * 1')
  async tunePromptSwarm(): Promise<void> {
    if (process.env.ENABLE_CRON === 'false') return;
    if ((process.env.PROMPT_AUTO_TUNE ?? 'true').toLowerCase() !== 'true') return;

    const tenant = await this.prisma.tenant.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!tenant) return;
    try {
      const result = await this.promptTune.tuneSwarm(tenant.id);
      this.logger.log(`Swarm de auto-ajuste: ${JSON.stringify(result.summary)}`);
    } catch (error) {
      this.logger.warn(`Falha no swarm de auto-ajuste: ${(error as Error).message}`);
    }
  }

  /** Terça a sexta, 7h — rotação diária (um perfil por dia). */
  @Cron('0 7 * * 2-5')
  async tunePrompt(): Promise<void> {
    if (process.env.ENABLE_CRON === 'false') return;
    if ((process.env.PROMPT_AUTO_TUNE ?? 'true').toLowerCase() !== 'true') return;

    const tenant = await this.prisma.tenant.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!tenant) return;
    try {
      const result = await this.promptTune.tuneDaily(tenant.id);
      this.logger.log(`Auto-ajuste de prompt: ${JSON.stringify(result)}`);
    } catch (error) {
      this.logger.warn(`Falha no auto-ajuste de prompt: ${(error as Error).message}`);
    }
  }

  /** Dias úteis, 19h — avalia os sinais pendentes do aprendizado. */
  @Cron('0 19 * * 1-5')
  async evaluateSignals(): Promise<void> {
    if (process.env.ENABLE_CRON === 'false') return;

    const tenants = await this.prisma.signalLog.findMany({
      select: { tenantId: true },
      distinct: ['tenantId'],
      where: { outcome: 'pending' },
    });

    for (const { tenantId } of tenants) {
      try {
        const result = await this.learning.evaluatePending(tenantId);
        if (result.evaluated) {
          this.logger.log(`Aprendizado ${tenantId}: ${result.evaluated} sinal(is) avaliado(s).`);
        }
      } catch (error) {
        this.logger.warn(`Falha ao avaliar sinais ${tenantId}: ${(error as Error).message}`);
      }
    }
  }

  /** Dias úteis, 12h — varre quedas com sinal de virada e notifica as quentes. */
  @Cron('0 12 * * 1-5')
  async hotOpportunities(): Promise<void> {
    if (process.env.ENABLE_CRON === 'false') return;

    const tenants = await this.prisma.tenant.findMany({
      where: { memberships: { some: {} } },
      select: { id: true },
    });

    for (const tenant of tenants) {
      try {
        const result = await this.opportunities.contrarian(tenant.id, 8);
        this.logger.log(
          `Quentes ${tenant.id}: ${result.items.filter((i) => i.score >= 70).length} papel(is) em reversão forte (${result.scanned} varridos).`,
        );
      } catch (error) {
        this.logger.warn(`Falha na varredura de quentes ${tenant.id}: ${(error as Error).message}`);
      }
    }
  }

  /** Segunda 8h — descobre papéis promissores e atualiza a watchlist. */
  @Cron('0 8 * * 1')
  async discoverSymbols(): Promise<void> {
    if (process.env.ENABLE_CRON === 'false') return;

    const tenants = await this.prisma.tenant.findMany({ select: { id: true } });
    for (const tenant of tenants) {
      try {
        const result = await this.discovery.scan(tenant.id, 8);
        this.logger.log(
          `Descoberta ${tenant.id}: ${result.saved.length} papel(is) na watchlist (${result.scanned} varridos).`,
        );
      } catch (error) {
        this.logger.warn(`Falha na descoberta ${tenant.id}: ${(error as Error).message}`);
      }
    }
  }

  /** Segunda 9h — resumo do ciclo atual a partir das análises da semana. */
  @Cron('0 9 * * 1')
  async refreshCycleSummary(): Promise<void> {
    if (process.env.ENABLE_CRON === 'false') return;

    const tenants = await this.prisma.opportunityBrief.findMany({
      select: { tenantId: true },
      distinct: ['tenantId'],
    });

    for (const { tenantId } of tenants) {
      try {
        await this.opportunities.refreshCycle(tenantId);
        this.logger.log(`Resumo do ciclo ${tenantId}: atualizado.`);
      } catch (error) {
        this.logger.warn(`Falha no resumo do ciclo ${tenantId}: ${(error as Error).message}`);
      }
      try {
        await this.opportunities.refreshActions(tenantId);
        this.logger.log(`Dicas de ação ${tenantId}: atualizadas.`);
      } catch (error) {
        this.logger.warn(`Falha nas dicas de ação ${tenantId}: ${(error as Error).message}`);
      }
    }
  }

  /** Dias úteis, 18h30 — gera e executa as propostas do paper trading. */
  @Cron('0 30 18 * * 1-5')
  async paperTrading(): Promise<void> {
    if (process.env.ENABLE_CRON === 'false') return;
    if ((process.env.PAPER_AUTO ?? 'true').toLowerCase() !== 'true') return;

    const tenants = await this.prisma.actionDigest.findMany({
      distinct: ['tenantId'],
      select: { tenantId: true },
    });

    for (const { tenantId } of tenants) {
      try {
        const result = await this.paper.generateFromDigest(tenantId);
        this.logger.log(
          `Paper trading ${tenantId}: ${result.created} proposta(s) executada(s) no paper, ` +
            `${result.skipped} ignorada(s).`,
        );
      } catch (error) {
        this.logger.warn(`Falha no paper trading ${tenantId}: ${(error as Error).message}`);
      }
    }
  }
}
