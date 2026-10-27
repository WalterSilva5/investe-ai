import { Module } from '@nestjs/common';
import { AiProviderModule } from '../ai-provider/ai-provider.module';
import { FixedIncomeModule } from '../fixed-income/fixed-income.module';
import { MarketModule } from '../market/market.module';
import { PortfoliosModule } from '../portfolios/portfolios.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiToolsService } from './ai-tools.service';
import { AiUsageService } from './ai-usage.service';

@Module({
  imports: [AiProviderModule, PortfoliosModule, FixedIncomeModule, MarketModule],
  controllers: [AiController],
  providers: [AiService, AiToolsService, AiUsageService],
})
export class AiModule {}
