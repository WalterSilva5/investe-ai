import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../types/auth-user';
import { LocalModeService } from '../local-mode.service';

/**
 * Resolve o tenant da requisição.
 *
 * Modo local (LOCAL_MODE=true, padrão): sem login; respeita o header
 * `x-tenant-id` para suportar múltiplos workspaces via seletor do menu
 * (vincula o usuário local automaticamente). Sem header, usa o `local`.
 * Modo com contas: header `x-tenant-id` → primeiro vínculo do usuário.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly localMode: LocalModeService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    if (this.localMode.isEnabled()) {
      const ctx = await this.localMode.ensureLocalContext();
      const headerTenant = String(request.headers['x-tenant-id'] || '').trim();
      if (headerTenant) {
        const tenant = await this.prisma.tenant.findUnique({ where: { id: headerTenant } });
        if (!tenant) {
          throw new ForbiddenException('Workspace não encontrado.');
        }
        await this.prisma.membership.upsert({
          where: { userId_tenantId: { userId: ctx.userId, tenantId: tenant.id } },
          create: { userId: ctx.userId, tenantId: tenant.id, role: 'OWNER' },
          update: {},
        });
        request.tenantId = tenant.id;
        request.tenantRole = 'OWNER';
        request.user = { ...(request.user || {}), userId: ctx.userId, email: ctx.email, tenantId: tenant.id, role: 'OWNER' };
        return true;
      }
      request.tenantId = ctx.tenantId;
      request.tenantRole = 'OWNER';
      request.user = { ...(request.user || {}), userId: ctx.userId, email: ctx.email, tenantId: ctx.tenantId, role: 'OWNER' };
      return true;
    }

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
