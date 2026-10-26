import { Global, Module } from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { TenantGuard } from './guards/tenant.guard';

@Global()
@Module({
  providers: [JwtAuthGuard, TenantGuard],
  exports: [JwtAuthGuard, TenantGuard],
})
export class CommonModule {}
