import { Module } from '@nestjs/common';
import { TransactionsModule } from '../transactions/transactions.module';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';

@Module({
  imports: [TransactionsModule],
  controllers: [ImportController],
  providers: [ImportService],
})
export class ImportModule {}
