import { Module } from '@nestjs/common';
import { PortfoliosModule } from '../portfolios/portfolios.module';
import { MarketController } from './market.controller';
import { MacroService } from './macro.service';
import { QuotesService } from './quotes.service';

@Module({
  imports: [PortfoliosModule],
  controllers: [MarketController],
  providers: [MacroService, QuotesService],
  exports: [MacroService, QuotesService],
})
export class MarketModule {}
