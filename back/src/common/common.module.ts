import { Global, Module } from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { TenantGuard } from './guards/tenant.guard';
import { LocalModeService } from './local-mode.service';

@Global()
@Module({
  providers: [JwtAuthGuard, TenantGuard, LocalModeService],
  exports: [JwtAuthGuard, TenantGuard, LocalModeService],
})
export class CommonModule {}
