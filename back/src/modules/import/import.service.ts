import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AssetType, TransactionType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TransactionsService } from '../transactions/transactions.service';
import { ImportTransactionsDto } from './dto/import-transactions.dto';

const ASSET_TYPES = new Set(Object.values(AssetType));
const TX_TYPES = new Set(Object.values(TransactionType));

@Injectable()
export class ImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactions: TransactionsService,
  ) {}

  template(): string {
    return [
      'date,type,symbol,name,assetType,quantity,price,fees,notes',
      '2026-10-01,BUY,PETR4,Petrobras PN,STOCK,100,30.00,5.00,compra inicial',
      '2026-10-02,BUY,TESOURO-SELIC,Tesouro Selic 2029,FIXED_INCOME,10,1000.00,0,',
    ].join('\n');
  }

  async import(tenantId: string, dto: ImportTransactionsDto) {
    const portfolio = await this.prisma.portfolio.findFirst({
      where: { id: dto.portfolioId, tenantId },
    });
    if (!portfolio) throw new NotFoundException('Carteira não encontrada.');

    const lines = dto.csv
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) throw new BadRequestException('CSV vazio.');

    const header = this.parseLine(lines[0]).map((h) => h.toLowerCase());
    const hasHeader = header.includes('date') && header.includes('symbol');
    const rows = hasHeader ? lines.slice(1) : lines;

    const errors: Array<{ line: number; error: string }> = [];
    const affectedAssets = new Set<string>();
    let imported = 0;

    for (let i = 0; i < rows.length; i += 1) {
      const cols = this.parseLine(rows[i]);
      const get = (name: string, fallback: number): string | undefined => {
        const index = hasHeader ? header.indexOf(name) : fallback;
        return index >= 0 ? cols[index] : undefined;
      };

      try {
        const date = get('date', 0);
        const type = (get('type', 1) || '').toUpperCase();
        const symbol = (get('symbol', 2) || '').toUpperCase();
        const name = get('name', 3) || symbol;
        const assetType = (get('assettype', 4) || 'STOCK').toUpperCase();
        const quantity = Number(get('quantity', 5));
        const price = Number(get('price', 6));
        const fees = Number(get('fees', 7) || 0);
        const notes = get('notes', 8);

        if (!date || Number.isNaN(Date.parse(date))) throw new Error('data inválida');
        if (!TX_TYPES.has(type as TransactionType)) throw new Error(`tipo inválido: ${type}`);
        if (!symbol) throw new Error('símbolo vazio');
        if (!ASSET_TYPES.has(assetType as AssetType)) throw new Error(`tipo de ativo inválido: ${assetType}`);
        if (!Number.isFinite(quantity) || quantity < 0) throw new Error('quantidade inválida');
        if (!Number.isFinite(price) || price < 0) throw new Error('preço inválido');

        const asset = await this.prisma.asset.upsert({
          where: { symbol_type: { symbol, type: assetType as AssetType } },
          create: { symbol, name, type: assetType as AssetType },
          update: {},
        });

        await this.prisma.transaction.create({
          data: {
            portfolioId: portfolio.id,
            assetId: asset.id,
            type: type as TransactionType,
            quantity,
            price,
            fees: Number.isFinite(fees) ? fees : 0,
            date: new Date(date),
            notes,
          },
        });

        affectedAssets.add(asset.id);
        imported += 1;
      } catch (error) {
        errors.push({
          line: i + (hasHeader ? 2 : 1),
          error: error instanceof Error ? error.message : 'erro desconhecido',
        });
      }
    }

    for (const assetId of affectedAssets) {
      await this.transactions.recomputePosition(portfolio.id, assetId);
    }

    const status = errors.length ? (imported ? 'PARTIAL' : 'FAILED') : 'DONE';
    await this.prisma.importJob.create({
      data: {
        tenantId,
        status,
        filename: 'inline.csv',
        result: { imported, errors } as never,
      },
    });

    return { imported, errors, status };
  }

  private parseLine(line: string): string[] {
    const out: string[] = [];
    let current = '';
    let quoted = false;
    for (const char of line) {
      if (char === '"') {
        quoted = !quoted;
      } else if (char === ',' && !quoted) {
        out.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    out.push(current.trim());
    return out;
  }
}
