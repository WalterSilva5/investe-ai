import { Module } from '@nestjs/common';
import { FixedIncomeController } from './fixed-income.controller';
import { FixedIncomeService } from './fixed-income.service';

@Module({
  controllers: [FixedIncomeController],
  providers: [FixedIncomeService],
  exports: [FixedIncomeService],
})
export class FixedIncomeModule {}
