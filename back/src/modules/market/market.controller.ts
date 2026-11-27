import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AssetType } from '@prisma/client';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { FxService } from './fx.service';
import { halvingContext } from './halving';
import { MacroService } from './macro.service';
import { QuotesService } from './quotes.service';
import { WhatIfService } from './whatif.service';

@ApiTags('market')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('market')
export class MarketController {
  constructor(
    private readonly macro: MacroService,
    private readonly quotes: QuotesService,
    private readonly fx: FxService,
    private readonly whatif: WhatIfService,
  ) {}

  @Get('macro')
  getMacro() {
    return this.macro.getMacro();
  }

  @Get('whatif')
  whatIf(
    @Query('symbol') symbol: string,
    @Query('amount') amount?: string,
    @Query('months') months?: string,
    @Query('monthly') monthly?: string,
  ) {
    return this.whatif.run(
      symbol || '',
      Number(amount) || 0,
      Number(months) || 12,
      Number(monthly) || 0,
    );
  }

  @Get('international')
  international() {
    return this.fx.overview();
  }

  @Get('quote/:symbol')
  getQuote(
    @Param('symbol') symbol: string,
    @Query('type') type?: AssetType,
  ) {
    return this.quotes.getQuote(symbol, type || AssetType.STOCK);
  }

  @Get('history')
  history(@Query('symbol') symbol?: string, @Query('range') range?: string) {
    return this.quotes.history(String(symbol || ''), range || '1y');
  }

  @Get('levels')
  levels(@Query('symbol') symbol?: string, @Query('range') range?: string) {
    return this.quotes.levels(String(symbol || ''), range || '6mo');
  }

  @Get('indicators')
  indicators(@Query('symbol') symbol?: string, @Query('range') range?: string) {
    return this.quotes.indicators(String(symbol || ''), range || '1y');
  }

  @Get('patterns')
  patterns(
    @Query('symbol') symbol?: string,
    @Query('setup') setup?: string,
    @Query('range') range?: string,
  ) {
    return this.quotes.patternBacktest(String(symbol || ''), setup, range || '2y');
  }

  @Get('outlook')
  outlook(@Query('symbol') symbol?: string, @Query('range') range?: string) {
    return this.quotes.outlook(String(symbol || ''), range || '1y');
  }

  @Get('halving')
  halving() {
    return halvingContext();
  }

  @Get('seer')
  seer(
    @Query('range') range?: string,
    @Query('limit') limit?: string,
    @Query('symbols') symbols?: string,
  ) {
    return this.quotes.seerScan(
      range || '1y',
      limit ? Number(limit) : 10,
      symbols ? symbols.split(',') : undefined,
    );
  }

  @Post('refresh')
  refresh(@TenantId() tenantId: string) {
    return this.quotes.refreshPortfolioPrices(tenantId);
  }
}
