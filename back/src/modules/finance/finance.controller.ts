import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsIn, IsNumber, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { FinanceService } from './finance.service';

class UpdateBookDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  label?: string;

  @IsOptional()
  @IsNumber()
  cashBalance?: number;

  @IsOptional()
  @IsNumber()
  emergencyReserve?: number;
}

class AddEntryDto {
  @IsIn(['income', 'expense'])
  kind: string;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;

  @IsOptional()
  @IsString()
  date?: string;
}

/** Assistente financeiro: caixa pessoal e da empresa para o agente saber o que há disponível. */
@Controller('finance')
@UseGuards(JwtAuthGuard, TenantGuard)
export class FinanceController {
  constructor(@Inject(FinanceService) private readonly finance: FinanceService) {}

  @Get('summary')
  summary(@TenantId() tenantId: string) {
    return this.finance.summary(tenantId);
  }

  @Get('books')
  books(@TenantId() tenantId: string) {
    return this.finance.listBooks(tenantId);
  }

  @Patch('books/:id')
  updateBook(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateBookDto,
  ) {
    return this.finance.updateBook(tenantId, id, dto);
  }

  @Post('books/:id/entries')
  addEntry(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: AddEntryDto,
  ) {
    return this.finance.addEntry(tenantId, id, dto);
  }

  @Get('books/:id/entries')
  entries(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    return this.finance.listEntries(tenantId, id, Number(limit) || 50);
  }

  @Delete('entries/:id')
  removeEntry(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.finance.removeEntry(tenantId, id);
  }
}
