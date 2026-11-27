import { Module } from '@nestjs/common';
import { MarketModule } from '../market/market.module';
import { PaperController } from './paper.controller';
import { PaperService } from './paper.service';

@Module({
  imports: [MarketModule],
  controllers: [PaperController],
  providers: [PaperService],
  exports: [PaperService],
})
export class PaperModule {}
