import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PaperService } from './paper.service';

@ApiTags('paper')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('paper')
export class PaperController {
  constructor(private readonly paper: PaperService) {}

  /** Propostas + posições simuladas, retorno e comparação com o CDI. */
  @Get('portfolio')
  portfolio(@TenantId() tenantId: string) {
    return this.paper.portfolio(tenantId);
  }

  /** Gera propostas do dia a partir do último digest de dicas de ação. */
  @Post('generate')
  generate(@TenantId() tenantId: string) {
    return this.paper.generateFromDigest(tenantId);
  }

  /** Recusa a proposta (fica fora do paper). */
  @Post('proposals/:id/reject')
  reject(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.paper.reject(id);
  }
}
