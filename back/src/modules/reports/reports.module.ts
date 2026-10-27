import { Module } from '@nestjs/common';
import { PortfoliosModule } from '../portfolios/portfolios.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [PortfoliosModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
