import { IsIn, IsNumber, IsOptional, Min } from 'class-validator';

export type FixedIncomeProduct = 'CDB' | 'LCI' | 'LCA' | 'TESOURO';
export type RateType = 'PREFIXED' | 'CDI_PERCENT' | 'IPCA_PLUS';

export class SimulateFixedIncomeDto {
  @IsNumber()
  @Min(1)
  principal: number;

  @IsNumber()
  @Min(1)
  months: number;

  @IsIn(['CDB', 'LCI', 'LCA', 'TESOURO'])
  product: FixedIncomeProduct;

  @IsIn(['PREFIXED', 'CDI_PERCENT', 'IPCA_PLUS'])
  rateType: RateType;

  @IsNumber()
  rate: number;

  @IsOptional()
  @IsNumber()
  cdiAnnual?: number;

  @IsOptional()
  @IsNumber()
  ipcaAnnual?: number;
}
