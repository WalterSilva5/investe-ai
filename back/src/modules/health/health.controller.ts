import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { LocalModeService } from '../../common/local-mode.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly localMode: LocalModeService) {}

  @Get()
  check() {
    const open = this.localMode.isEnabled();
    return {
      status: 'ok',
      service: 'wsi-invest-ai',
      timestamp: new Date().toISOString(),
      authEnabled: !open,
      localMode: open,
    };
  }
}
