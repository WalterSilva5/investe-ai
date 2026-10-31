import { Injectable } from '@nestjs/common';
import { AssetType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAssetDto } from './dto/create-asset.dto';

@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService) {}

  list(type?: AssetType, search?: string) {
    return this.prisma.asset.findMany({
      where: {
        ...(type ? { type } : {}),
        ...(search
          ? {
              OR: [
                { symbol: { contains: search } },
                { name: { contains: search } },
              ],
            }
          : {}),
      },
      orderBy: [{ type: 'asc' }, { symbol: 'asc' }],
      take: 200,
    });
  }

  create(dto: CreateAssetDto) {
    return this.prisma.asset.upsert({
      where: { symbol_type: { symbol: dto.symbol.toUpperCase(), type: dto.type } },
      create: {
        symbol: dto.symbol.toUpperCase(),
        name: dto.name,
        type: dto.type,
        currency: dto.currency || 'BRL',
      },
      update: { name: dto.name, currency: dto.currency || 'BRL' },
    });
  }

  get(id: string) {
    return this.prisma.asset.findUnique({ where: { id } });
  }
}
