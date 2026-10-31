import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { AiProviderRegistry } from './ai-provider.registry';
import { SaveCredentialDto } from './dto/save-credential.dto';
import { TestProviderDto } from './dto/test-provider.dto';

@ApiTags('ai-providers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('ai/providers')
export class AiProviderController {
  constructor(private readonly registry: AiProviderRegistry) {}

  @Get()
  list(@TenantId() tenantId: string) {
    return this.registry.listForTenant(tenantId);
  }

  @Post(':providerId/credential')
  save(
    @TenantId() tenantId: string,
    @CurrentUser() user: { userId: string },
    @Param('providerId') providerId: string,
    @Body() dto: SaveCredentialDto,
  ) {
    return this.registry.saveCredential(tenantId, user.userId, providerId, dto);
  }

  @Post(':providerId/test')
  test(
    @TenantId() tenantId: string,
    @Param('providerId') providerId: string,
    @Body() dto: TestProviderDto,
  ) {
    return this.registry.test(tenantId, providerId, dto);
  }

  @Get(':providerId/models')
  models(@TenantId() tenantId: string, @Param('providerId') providerId: string) {
    return this.registry.listModels(tenantId, providerId);
  }
}
