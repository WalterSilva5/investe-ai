import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CreateAccountDto } from './dto/create-account.dto';
import { CreatePortfolioDto, UpdatePortfolioDto } from './dto/portfolio.dto';
import { PortfoliosService } from './portfolios.service';

@ApiTags('portfolios')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('portfolios')
export class PortfoliosController {
  constructor(private readonly portfolios: PortfoliosService) {}

  @Get()
  list(@TenantId() tenantId: string) {
    return this.portfolios.list(tenantId);
  }

  @Post()
  create(@TenantId() tenantId: string, @Body() dto: CreatePortfolioDto) {
    return this.portfolios.create(tenantId, dto);
  }

  @Get(':id')
  get(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.portfolios.get(tenantId, id);
  }

  @Patch(':id')
  update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePortfolioDto,
  ) {
    return this.portfolios.update(tenantId, id, dto);
  }

  @Delete(':id')
  remove(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.portfolios.remove(tenantId, id);
  }

  @Post(':id/accounts')
  addAccount(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: CreateAccountDto,
  ) {
    return this.portfolios.addAccount(tenantId, id, dto);
  }

  @Get(':id/positions')
  positions(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.portfolios.positions(tenantId, id);
  }

  @Get(':id/allocation')
  allocation(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.portfolios.allocation(tenantId, id);
  }

  @Get(':id/summary')
  summary(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.portfolios.summary(tenantId, id);
  }
}
