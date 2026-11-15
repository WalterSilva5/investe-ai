import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  check() {
    const raw = (this.config.get<string>('LOCAL_MODE') ?? 'true').toLowerCase().trim();
    return {
      status: 'ok',
      service: 'wsi-invest-ai',
      timestamp: new Date().toISOString(),
      localMode: raw === 'true' || raw === '1' || raw === 'yes',
    };
  }
}
