import { Global, Module } from '@nestjs/common';
import { PromptRegistryService } from './prompt-registry.service';
import { PromptSimService } from './sim/prompt-sim.service';
import { SimController } from './sim.controller';
import { MarketModule } from '../market/market.module';
import { AiProviderModule } from '../ai-provider/ai-provider.module';

@Global()
@Module({
  imports: [MarketModule, AiProviderModule],
  providers: [PromptRegistryService, PromptSimService],
  exports: [PromptRegistryService, PromptSimService],
  controllers: [SimController],
})
export class PromptsModule {}
