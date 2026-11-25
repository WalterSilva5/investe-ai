import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { AlertsService } from '../alerts/alerts.service';
import { QuotesService } from '../market/quotes.service';
import { InsightsService } from '../insights/insights.service';
import { OpportunitiesService } from '../opportunities/opportunities.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly quotes: QuotesService,
    private readonly alerts: AlertsService,
    private readonly insights: InsightsService,
    private readonly opportunities: OpportunitiesService,
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
}
