import { Module } from '@nestjs/common';
import { AiProviderModule } from '../ai-provider/ai-provider.module';
import { MarketModule } from '../market/market.module';
import { PortfoliosModule } from '../portfolios/portfolios.module';
import { InsightsController } from './insights.controller';
import { InsightsService } from './insights.service';
import { NewsService } from './news.service';

@Module({
  imports: [AiProviderModule, MarketModule, PortfoliosModule],
  controllers: [InsightsController],
  providers: [InsightsService, NewsService],
  exports: [InsightsService],
})
export class InsightsModule {}
