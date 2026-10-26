import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../types/auth-user';

/**
 * Resolve o tenant da requisição.
 *
 * Ordem: header `x-tenant-id` → primeiro vínculo do usuário.
 * Verifica o vínculo e anexa tenantId/role ao request.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser | undefined;
    if (!user?.userId) {
      throw new ForbiddenException('Usuário não autenticado.');
    }

    const headerTenant = String(request.headers['x-tenant-id'] || '').trim();

    const membership = headerTenant
      ? await this.prisma.membership.findUnique({
          where: { userId_tenantId: { userId: user.userId, tenantId: headerTenant } },
        })
      : await this.prisma.membership.findFirst({
          where: { userId: user.userId },
          orderBy: { id: 'asc' },
        });

    if (!membership) {
      throw new ForbiddenException('Sem acesso a este tenant.');
    }

    request.tenantId = membership.tenantId;
    request.tenantRole = membership.role;
    request.user = { ...user, tenantId: membership.tenantId, role: membership.role };
    return true;
  }
}
