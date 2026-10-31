import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { AlertsService } from '../alerts/alerts.service';
import { QuotesService } from '../market/quotes.service';
import { InsightsService } from '../insights/insights.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly quotes: QuotesService,
    private readonly alerts: AlertsService,
    private readonly insights: InsightsService,
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
        const result = await this.insights.refresh(tenant.id);
        this.logger.log(`Insights ${tenant.id}: ${result.generated} gerado(s).`);
      } catch (error) {
        this.logger.warn(`Falha ao gerar insights ${tenant.id}: ${(error as Error).message}`);
      }
    }
  }
}
