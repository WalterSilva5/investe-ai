import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TeachService } from './teach.service';

@ApiTags('teach')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('teach')
export class TeachController {
  constructor(private readonly teach: TeachService) {}

  @Get()
  curriculum(@TenantId() tenantId: string) {
    return this.teach.curriculum(tenantId);
  }

  @Get(':id')
  lesson(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.teach.lesson(tenantId, id);
  }

  @Post(':id/answer')
  answer(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: { value?: string },
  ) {
    return this.teach.answer(tenantId, id, String(body?.value || ''));
  }

  @Post(':id/complete')
  complete(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.teach.complete(tenantId, id);
  }
}
