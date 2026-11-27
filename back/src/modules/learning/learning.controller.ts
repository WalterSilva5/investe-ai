import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { LearningService } from './learning.service';

@ApiTags('learning')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('learning')
export class LearningController {
  constructor(private readonly learning: LearningService) {}

  /** Outlook da ação com score calibrado pelo histórico das regras. */
  @Get('outlook')
  outlook(
    @TenantId() tenantId: string,
    @Query('symbol') symbol?: string,
    @Query('range') range?: string,
  ) {
    return this.learning.outlook(tenantId, String(symbol || ''), range || '1y');
  }

  @Get('summary')
  summary(@TenantId() tenantId: string) {
    return this.learning.summary(tenantId);
  }

  @Post('evaluate')
  evaluate(@TenantId() tenantId: string) {
    return this.learning.evaluatePending(tenantId);
  }
}
