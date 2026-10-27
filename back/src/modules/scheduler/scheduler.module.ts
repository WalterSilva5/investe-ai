import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { MarketModule } from '../market/market.module';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [MarketModule, AlertsModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
