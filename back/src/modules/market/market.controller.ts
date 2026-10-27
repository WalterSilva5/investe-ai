import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AssetType } from '@prisma/client';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { MacroService } from './macro.service';
import { QuotesService } from './quotes.service';

@ApiTags('market')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('market')
export class MarketController {
  constructor(
    private readonly macro: MacroService,
    private readonly quotes: QuotesService,
  ) {}

  @Get('macro')
  getMacro() {
    return this.macro.getMacro();
  }

  @Get('quote/:symbol')
  getQuote(
    @Param('symbol') symbol: string,
    @Query('type') type?: AssetType,
  ) {
    return this.quotes.getQuote(symbol, type || AssetType.STOCK);
  }

  @Post('refresh')
  refresh(@TenantId() tenantId: string) {
    return this.quotes.refreshPortfolioPrices(tenantId);
  }
}
