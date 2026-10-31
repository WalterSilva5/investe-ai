import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { BankingService } from './banking.service';
import { ImportStatementDto } from './dto/import-statement.dto';

@ApiTags('banking')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('banking')
export class BankingController {
  constructor(private readonly banking: BankingService) {}

  @Get('statements')
  list(@TenantId() tenantId: string) {
    return this.banking.list(tenantId);
  }

  @Get('summary')
  summary(@TenantId() tenantId: string, @Query('months') months?: string) {
    return this.banking.summary(tenantId, months ? Number(months) : 6);
  }

  @Post('statements')
  import(@TenantId() tenantId: string, @Body() dto: ImportStatementDto) {
    return this.banking.import(tenantId, dto);
  }

  @Get('statements/:id')
  get(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.banking.get(tenantId, id);
  }

  @Delete('statements/:id')
  remove(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.banking.remove(tenantId, id);
  }
}
