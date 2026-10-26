import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  listForUser(userId: string) {
    return this.prisma.membership.findMany({
      where: { userId },
      include: {
        tenant: { select: { id: true, name: true, slug: true, plan: true } },
      },
      orderBy: { tenant: { createdAt: 'asc' } },
    });
  }
}
