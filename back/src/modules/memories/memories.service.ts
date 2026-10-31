import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMemoryDto } from './dto/create-memory.dto';

@Injectable()
export class MemoriesService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.memory.findMany({
      where: { tenantId },
      orderBy: [{ importance: 'desc' }, { updatedAt: 'desc' }],
      take: 200,
    });
  }

  create(tenantId: string, dto: CreateMemoryDto) {
    return this.prisma.memory.create({
      data: {
        tenantId,
        content: dto.content,
        kind: dto.kind || 'fact',
        tags: dto.tags,
        importance: dto.importance ?? 5,
      },
    });
  }

  async remove(tenantId: string, id: string) {
    const memory = await this.prisma.memory.findFirst({ where: { id, tenantId } });
    if (!memory) throw new NotFoundException('Memória não encontrada.');
    await this.prisma.memory.delete({ where: { id } });
    return { ok: true };
  }

  search(tenantId: string, query: string, limit = 8) {
    const q = query.trim();
    if (!q) return [];
    return this.prisma.memory.findMany({
      where: {
        tenantId,
        OR: [
          { content: { contains: q } },
          { tags: { contains: q } },
          { kind: { contains: q } },
        ],
      },
      orderBy: [{ importance: 'desc' }, { updatedAt: 'desc' }],
      take: limit,
    });
  }

  top(tenantId: string, limit = 6) {
    return this.prisma.memory.findMany({
      where: { tenantId },
      orderBy: [{ importance: 'desc' }, { updatedAt: 'desc' }],
      take: limit,
    });
  }
}
