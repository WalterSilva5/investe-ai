import { Module } from '@nestjs/common';
import { AiProviderController } from './ai-provider.controller';
import { AiProviderRegistry } from './ai-provider.registry';
import { EncryptionService } from './encryption.service';

@Module({
  controllers: [AiProviderController],
  providers: [AiProviderRegistry, EncryptionService],
  exports: [AiProviderRegistry, EncryptionService],
})
export class AiProviderModule {}
