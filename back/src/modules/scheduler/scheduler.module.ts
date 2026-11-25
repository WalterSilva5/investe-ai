import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { MarketModule } from '../market/market.module';
import { InsightsModule } from '../insights/insights.module';
import { OpportunitiesModule } from '../opportunities/opportunities.module';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [MarketModule, AlertsModule, InsightsModule, OpportunitiesModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
