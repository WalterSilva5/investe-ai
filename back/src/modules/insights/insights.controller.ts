import { Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { InsightsService } from './insights.service';

@ApiTags('insights')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('insights')
export class InsightsController {
  constructor(private readonly insights: InsightsService) {}

  @Get()
  list(@TenantId() tenantId: string) {
    return this.insights.list(tenantId);
  }

  @Post('refresh')
  refresh(@TenantId() tenantId: string) {
    return this.insights.refresh(tenantId);
  }

  @Patch(':id/read')
  markRead(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.insights.markRead(tenantId, id);
  }
}
