import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDocumentDto } from './dto/create-document.dto';

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.document.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
  }

  create(tenantId: string, dto: CreateDocumentDto) {
    return this.prisma.document.create({
      data: {
        tenantId,
        title: dto.title,
        body: dto.body,
        tags: dto.tags,
      },
    });
  }

  async get(tenantId: string, id: string) {
    const document = await this.prisma.document.findFirst({ where: { id, tenantId } });
    if (!document) throw new NotFoundException('Documento não encontrado.');
    return document;
  }

  async remove(tenantId: string, id: string) {
    await this.get(tenantId, id);
    await this.prisma.document.delete({ where: { id } });
    return { ok: true };
  }

  search(tenantId: string, query: string, limit = 8) {
    const q = query.trim();
    if (!q) return [];
    return this.prisma.document.findMany({
      where: {
        tenantId,
        OR: [
          { title: { contains: q } },
          { body: { contains: q } },
          { tags: { contains: q } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
  }
}
