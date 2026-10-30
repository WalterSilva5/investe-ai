import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const email = String(request.user?.email || '').toLowerCase();
    const allowed = (this.config.get<string>('ADMIN_EMAILS') || '')
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);

    if (!email || !allowed.includes(email)) {
      throw new ForbiddenException('Acesso restrito.');
    }
    return true;
  }
}
