import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  listForUser(userId: string) {
    return this.prisma.membership.findMany({
      where: { userId },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            plan: true,
            kind: true,
            cnpj: true,
          },
        },
      },
      orderBy: { tenant: { createdAt: 'asc' } },
    });
  }

  /** Cria um workspace (por padrão uma empresa) e vincula o usuário como OWNER. */
  async create(userId: string, dto: CreateTenantDto) {
    const kind = (dto.kind || 'COMPANY').toUpperCase();
    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.name.trim(),
        slug: await this.uniqueSlug(dto.name.trim()),
        kind: kind === 'PERSONAL' ? 'PERSONAL' : 'COMPANY',
        cnpj: dto.cnpj?.trim() || null,
      },
    });
    await this.prisma.membership.create({
      data: { userId, tenantId: tenant.id, role: 'OWNER' },
    });
    return tenant;
  }

  private async uniqueSlug(base: string): Promise<string> {
    const normalized =
      base
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 40) || 'workspace';

    for (let i = 0; i < 5; i += 1) {
      const slug = i === 0 ? normalized : `${normalized}-${randomBytes(3).toString('hex')}`;
      const exists = await this.prisma.tenant.findUnique({ where: { slug } });
      if (!exists) return slug;
    }
    return `${normalized}-${randomBytes(6).toString('hex')}`;
  }
}
