import { Module } from '@nestjs/common';
import { AiProviderModule } from '../ai-provider/ai-provider.module';
import { FixedIncomeModule } from '../fixed-income/fixed-income.module';
import { DocumentsModule } from '../documents/documents.module';
import { MemoriesModule } from '../memories/memories.module';
import { AnalysisModule } from '../analysis/analysis.module';
import { MarketModule } from '../market/market.module';
import { FinanceModule } from '../finance/finance.module';
import { PortfoliosModule } from '../portfolios/portfolios.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiToolsService } from './ai-tools.service';
import { AiUsageService } from './ai-usage.service';
import { DiscoveryModule } from '../discovery/discovery.module';
import { LearningModule } from '../learning/learning.module';
import { PromptsModule } from '../prompts/prompts.module';
import { PromptAdminController } from './prompt-admin.controller';
import { PromptEvalService } from './prompt-eval.service';
import { PromptTuneService } from './prompt-tune.service';
import { OpportunitiesModule } from '../opportunities/opportunities.module';

@Module({
  imports: [AiProviderModule, PortfoliosModule, FinanceModule, FixedIncomeModule, DocumentsModule, MemoriesModule, AnalysisModule, MarketModule, DiscoveryModule, LearningModule, PromptsModule, OpportunitiesModule],
  controllers: [AiController, PromptAdminController],
  providers: [AiService, AiToolsService, AiUsageService, PromptEvalService, PromptTuneService],
  exports: [AiService, PromptTuneService],
})
export class AiModule {}
