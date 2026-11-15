import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { LocalModeService } from '../local-mode.service';

/**
 * Em modo local (LOCAL_MODE=true, padrão) o acesso é liberado sem JWT,
 * usando o usuário/tenant fixo `local@wsi.local`.
 * Em deploy aberto (LOCAL_MODE=false) exige JWT normalmente.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly localMode: LocalModeService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.localMode.isEnabled()) {
      const ctx = await this.localMode.ensureLocalContext();
      const request = context.switchToHttp().getRequest();
      request.user = { userId: ctx.userId, email: ctx.email };
      return true;
    }
    return super.canActivate(context) as Promise<boolean>;
  }
}
