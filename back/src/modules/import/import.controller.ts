import { Body, Controller, Get, Header, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ImportTransactionsDto } from './dto/import-transactions.dto';
import { ImportService } from './import.service';

@ApiTags('import')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('import')
export class ImportController {
  constructor(private readonly importer: ImportService) {}

  @Get('template')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="modelo-importacao.csv"')
  template() {
    return this.importer.template();
  }

  @Post('transactions')
  import(@TenantId() tenantId: string, @Body() dto: ImportTransactionsDto) {
    return this.importer.import(tenantId, dto);
  }
}
