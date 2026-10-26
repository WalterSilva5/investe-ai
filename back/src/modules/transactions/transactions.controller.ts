import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { TransactionsService } from './transactions.service';

@ApiTags('transactions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller()
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get('portfolios/:id/transactions')
  list(@TenantId() tenantId: string, @Param('id') portfolioId: string) {
    return this.transactions.list(tenantId, portfolioId);
  }

  @Post('portfolios/:id/transactions')
  create(
    @TenantId() tenantId: string,
    @Param('id') portfolioId: string,
    @Body() dto: CreateTransactionDto,
  ) {
    return this.transactions.create(tenantId, portfolioId, dto);
  }

  @Delete('transactions/:id')
  remove(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.transactions.remove(tenantId, id);
  }
}
