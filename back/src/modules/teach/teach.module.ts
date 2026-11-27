import { Module } from '@nestjs/common';
import { MarketModule } from '../market/market.module';
import { TeachController } from './teach.controller';
import { TeachService } from './teach.service';

@Module({
  imports: [MarketModule],
  controllers: [TeachController],
  providers: [TeachService],
  exports: [TeachService],
})
export class TeachModule {}
