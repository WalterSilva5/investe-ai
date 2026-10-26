import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { SimulateFixedIncomeDto } from './dto/simulate.dto';
import { FixedIncomeService } from './fixed-income.service';

@ApiTags('fixed-income')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('fixed-income')
export class FixedIncomeController {
  constructor(private readonly fixedIncome: FixedIncomeService) {}

  @Post('simulate')
  simulate(@Body() dto: SimulateFixedIncomeDto) {
    return this.fixedIncome.simulate(dto);
  }

  @Post('compare')
  compare(@Body() items: SimulateFixedIncomeDto[]) {
    return this.fixedIncome.compare(items);
  }
}
