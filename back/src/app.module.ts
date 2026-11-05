import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { AssetsModule } from './modules/assets/assets.module';
import { PortfoliosModule } from './modules/portfolios/portfolios.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { FixedIncomeModule } from './modules/fixed-income/fixed-income.module';
import { MarketModule } from './modules/market/market.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { ImportModule } from './modules/import/import.module';
import { ReportsModule } from './modules/reports/reports.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { MemoriesModule } from './modules/memories/memories.module';
import { AnalysisModule } from './modules/analysis/analysis.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { AdminModule } from './modules/admin/admin.module';
import { AiProviderModule } from './modules/ai-provider/ai-provider.module';
import { AiModule } from './modules/ai/ai.module';
import { InsightsModule } from './modules/insights/insights.module';
import { BankingModule } from './modules/banking/banking.module';
import { OpportunitiesModule } from './modules/opportunities/opportunities.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    CommonModule,
    HealthModule,
    AuthModule,
    TenantsModule,
    AssetsModule,
    PortfoliosModule,
    TransactionsModule,
    FixedIncomeModule,
    MarketModule,
    AlertsModule,
    ImportModule,
    ReportsModule,
    DocumentsModule,
    MemoriesModule,
    AnalysisModule,
    SchedulerModule,
    AdminModule,
    AiProviderModule,
    AiModule,
    InsightsModule,
    BankingModule,
    OpportunitiesModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
