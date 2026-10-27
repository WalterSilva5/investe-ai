import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MacroService } from '../market/macro.service';
import { PortfoliosService } from '../portfolios/portfolios.service';
import { CreateAlertDto, UpdateAlertDto } from './dto/alert.dto';

@Injectable()
export class AlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly portfolios: PortfoliosService,
    private readonly macro: MacroService,
  ) {}

  list(tenantId: string) {
    return this.prisma.alertRule.findMany({
      where: { tenantId },
      include: { events: { orderBy: { firedAt: 'desc' }, take: 10 } },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(tenantId: string, dto: CreateAlertDto) {
    return this.prisma.alertRule.create({
      data: {
        tenantId,
        type: dto.type,
        condition: dto.condition as never,
        enabled: dto.enabled ?? true,
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateAlertDto) {
    await this.assertRule(tenantId, id);
    return this.prisma.alertRule.update({
      where: { id },
      data: {
        ...(dto.condition !== undefined ? { condition: dto.condition as never } : {}),
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.assertRule(tenantId, id);
    await this.prisma.alertRule.delete({ where: { id } });
    return { ok: true };
  }

  async evaluate(tenantId: string) {
    const rules = await this.prisma.alertRule.findMany({
      where: { tenantId, enabled: true },
    });
    const created: Array<{ ruleId: string; message: string; current: unknown }> = [];

    for (const rule of rules) {
      const result = await this.evaluateRule(tenantId, rule);
      if (!result.triggered) continue;

      const recent = await this.prisma.alertEvent.findFirst({
        where: {
          ruleId: rule.id,
          firedAt: { gte: new Date(Date.now() - 6 * 60 * 60 * 1000) },
        },
      });
      if (recent) continue;

      await this.prisma.alertEvent.create({
        data: {
          ruleId: rule.id,
          payload: {
            message: result.message,
            current: result.current,
            threshold: rule.condition,
          } as never,
        },
      });
      created.push({
        ruleId: rule.id,
        message: result.message,
        current: result.current,
      });
    }

    return { triggered: created.length, events: created };
  }

  private async evaluateRule(
    tenantId: string,
    rule: { type: string; condition: unknown },
  ): Promise<{ triggered: boolean; message: string; current: unknown }> {
    const condition = (rule.condition || {}) as Record<string, unknown>;

    if (rule.type === 'ALLOCATION_MAX') {
      const portfolio = await this.portfolios.getDefaultPortfolio(tenantId);
      if (!portfolio) {
        return { triggered: false, message: 'Sem carteira.', current: null };
      }
      const allocation = await this.portfolios.allocation(tenantId, portfolio.id);
      const assetType = String(condition.assetType || 'STOCK');
      const maxPct = Number(condition.maxPct || 60);
      const item = allocation.byType.find((t) => t.type === assetType);
      const pct = item?.pct ?? 0;
      return {
        triggered: pct > maxPct,
        message: `${assetType} em ${pct.toFixed(1)}% (limite ${maxPct}%).`,
        current: pct,
      };
    }

    if (rule.type === 'MACRO') {
      const macro = (await this.macro.getMacro()) as Record<string, unknown>;
      if (!macro.available) {
        return { triggered: false, message: 'Macro indisponível.', current: null };
      }
      const metric = String(condition.metric || 'selic');
      const operator = String(condition.operator || '>');
      const value = Number(condition.value || 0);
      const current = Number(macro[metric]);
      const triggered =
        operator === '>' ? current > value : operator === '<' ? current < value : false;
      return {
        triggered,
        message: `${metric} em ${current.toFixed(2)} (${operator} ${value}).`,
        current,
      };
    }

    return { triggered: false, message: 'Regra desconhecida.', current: null };
  }

  private async assertRule(tenantId: string, id: string) {
    const rule = await this.prisma.alertRule.findFirst({ where: { id, tenantId } });
    if (!rule) throw new NotFoundException('Regra não encontrada.');
    return rule;
  }
}
