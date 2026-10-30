import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { AnalysisService } from './analysis.service';
import { ProjectDto, RebalanceDto, RunwayDto } from './dto/analysis.dto';

@ApiTags('analysis')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('analysis')
export class AnalysisController {
  constructor(private readonly analysis: AnalysisService) {}

  @Post('runway')
  runway(@TenantId() tenantId: string, @Body() dto: RunwayDto) {
    return this.analysis.runway(tenantId, dto);
  }

  @Post('project')
  project(@Body() dto: ProjectDto) {
    return this.analysis.project(dto);
  }

  @Post('rebalance')
  rebalance(@TenantId() tenantId: string, @Body() dto: RebalanceDto) {
    return this.analysis.rebalance(tenantId, dto);
  }
}
