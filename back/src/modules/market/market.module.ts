import { Module } from '@nestjs/common';
import { MarketController } from './market.controller';
import { MacroService } from './macro.service';

@Module({
  controllers: [MarketController],
  providers: [MacroService],
  exports: [MacroService],
})
export class MarketModule {}
