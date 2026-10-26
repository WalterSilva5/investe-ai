import { Module } from '@nestjs/common';
import { AiProviderModule } from '../ai-provider/ai-provider.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

@Module({
  imports: [AiProviderModule],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
