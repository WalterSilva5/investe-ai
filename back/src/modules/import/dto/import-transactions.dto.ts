import { IsString, MinLength } from 'class-validator';

export class ImportTransactionsDto {
  @IsString()
  @MinLength(1)
  portfolioId: string;

  @IsString()
  @MinLength(1)
  csv: string;
}
