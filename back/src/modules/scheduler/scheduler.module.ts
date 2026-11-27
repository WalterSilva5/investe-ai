import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { MarketModule } from '../market/market.module';
import { InsightsModule } from '../insights/insights.module';
import { LearningModule } from '../learning/learning.module';
import { DiscoveryModule } from '../discovery/discovery.module';
import { OpportunitiesModule } from '../opportunities/opportunities.module';
import { PromptsModule } from '../prompts/prompts.module';
import { AiModule } from '../ai/ai.module';
import { PaperModule } from '../paper/paper.module';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [MarketModule, AlertsModule, InsightsModule, OpportunitiesModule, LearningModule, DiscoveryModule, PromptsModule, AiModule, PaperModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
