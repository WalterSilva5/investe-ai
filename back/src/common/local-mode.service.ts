import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

export const LOCAL_USER_EMAIL = 'local@wsi.local';
export const LOCAL_TENANT_SLUG = 'local';

/**
 * Modo local: uso sem cadastro/login.
 * Ativo por padrão (LOCAL_MODE=true). Para deploy aberto com contas,
 * defina LOCAL_MODE=false.
 */
@Injectable()
export class LocalModeService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  isEnabled(): boolean {
    const raw = (this.config.get<string>('LOCAL_MODE') ?? 'true').toLowerCase().trim();
    return raw === 'true' || raw === '1' || raw === 'yes';
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
