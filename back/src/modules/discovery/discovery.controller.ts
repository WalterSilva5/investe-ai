import { Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { DiscoveryService } from './discovery.service';

@ApiTags('discovery')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('discovery')
export class DiscoveryController {
  constructor(private readonly discovery: DiscoveryService) {}

  @Get('tracked')
  tracked(@TenantId() tenantId: string) {
    return this.discovery.tracked(tenantId);
  }

  @Post('scan')
  scan(@TenantId() tenantId: string, @Query('limit') limit?: string) {
    return this.discovery.scan(tenantId, limit ? Number(limit) : 8);
  }

  @Post('tracked/:symbol')
  track(@TenantId() tenantId: string, @Param('symbol') symbol: string) {
    return this.discovery.track(tenantId, symbol);
  }

  @Delete('tracked/:symbol')
  untrack(@TenantId() tenantId: string, @Param('symbol') symbol: string) {
    return this.discovery.untrack(tenantId, symbol);
  }
}
