import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { OpportunitiesService } from './opportunities.service';

@ApiTags('opportunities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('opportunities')
export class OpportunitiesController {
  constructor(private readonly opportunities: OpportunitiesService) {}

  @Get('themes')
  themes() {
    return this.opportunities.themes();
  }

  @Get('cycles')
  cycles() {
    return this.opportunities.cycles();
  }

  @Get('radar')
  radar(@TenantId() tenantId: string) {
    return this.opportunities.radar(tenantId);
  }

  @Get()
  list(@TenantId() tenantId: string, @Query('theme') theme?: string) {
    return this.opportunities.list(tenantId, theme);
  }

  @Post(':theme/analyze')
  analyze(
    @TenantId() tenantId: string,
    @Param('theme') theme: string,
    @Body() body: { mode?: string },
  ) {
    return this.opportunities.analyze(tenantId, theme, body?.mode);
  }
}
