import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { BusinessService } from './business.service';
import { GenerateIdeasDto } from './dto/generate-ideas.dto';
import { UpsertProfileDto } from './dto/upsert-profile.dto';

@ApiTags('business')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('business')
export class BusinessController {
  constructor(private readonly business: BusinessService) {}

  @Get('profile')
  profile(@TenantId() tenantId: string) {
    return this.business.getProfile(tenantId);
  }

  @Put('profile')
  saveProfile(@TenantId() tenantId: string, @Body() dto: UpsertProfileDto) {
    return this.business.upsertProfile(tenantId, dto);
  }

  @Get('catalog')
  catalog() {
    return this.business.catalog();
  }

  @Get('ideas')
  ideas(@TenantId() tenantId: string) {
    return this.business.listIdeas(tenantId);
  }

  @Post('ideas')
  generate(@TenantId() tenantId: string, @Body() dto: GenerateIdeasDto) {
    return this.business.generateIdeas(tenantId, dto);
  }
}
