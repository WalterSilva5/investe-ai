import { Module } from '@nestjs/common';
import { AiProviderModule } from '../ai-provider/ai-provider.module';
import { BusinessController } from './business.controller';
import { BusinessService } from './business.service';

@Module({
  imports: [AiProviderModule],
  controllers: [BusinessController],
  providers: [BusinessService],
})
export class BusinessModule {}
