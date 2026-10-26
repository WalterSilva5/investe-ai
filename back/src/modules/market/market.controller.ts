import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { MacroService } from './macro.service';

@ApiTags('market')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('market')
export class MarketController {
  constructor(private readonly macro: MacroService) {}

  @Get('macro')
  getMacro() {
    return this.macro.getMacro();
  }
}
