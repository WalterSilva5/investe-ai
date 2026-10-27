import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
import { AiProviderModule } from './modules/ai-provider/ai-provider.module';
import { AiModule } from './modules/ai/ai.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
    AiProviderModule,
    AiModule,
  ],
})
export class AppModule {}
