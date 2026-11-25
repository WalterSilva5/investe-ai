import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

export const LOCAL_USER_EMAIL = 'local@wsi.local';
export const LOCAL_TENANT_SLUG = 'local';

/**
 * Modo aberto: uso sem cadastro/login (padrão para uso pessoal local).
 * Controlado por AUTH_ENABLED (padrão: false = aberto). Para deploy aberto
 * com contas, defina AUTH_ENABLED=true. LOCAL_MODE é alias legado
 * (LOCAL_MODE=true equivale a AUTH_ENABLED=false).
 */
@Injectable()
export class LocalModeService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /** true = ambiente aberto, sem autenticação. */
  isEnabled(): boolean {
    const auth = this.config.get<string>('AUTH_ENABLED');
    if (auth !== undefined && auth !== null && String(auth).trim() !== '') {
      const v = String(auth).toLowerCase().trim();
      return !(v === 'true' || v === '1' || v === 'yes');
    }
    const legacy = (this.config.get<string>('LOCAL_MODE') ?? 'true').toLowerCase().trim();
    return legacy === 'true' || legacy === '1' || legacy === 'yes';
  }

  isAuthEnabled(): boolean {
    return !this.isEnabled();
  }

  async ensureLocalContext(): Promise<{ userId: string; tenantId: string; email: string }> {
    let user = await this.prisma.user.findUnique({ where: { email: LOCAL_USER_EMAIL } });
    if (!user) {
      user = await this.prisma.user.create({
        data: { email: LOCAL_USER_EMAIL, name: 'Local', emailVerifiedAt: new Date() },
      });
    }
    let tenant = await this.prisma.tenant.findUnique({ where: { slug: LOCAL_TENANT_SLUG } });
    if (!tenant) {
      tenant = await this.prisma.tenant.create({
        data: { name: 'Local', slug: LOCAL_TENANT_SLUG },
      });
    }
    await this.prisma.membership.upsert({
      where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } },
      create: { userId: user.id, tenantId: tenant.id, role: 'OWNER' },
      update: {},
    });
    return { userId: user.id, tenantId: tenant.id, email: user.email };
  }
}
