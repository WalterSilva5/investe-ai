import { IsNumber, IsObject, IsOptional, Min } from 'class-validator';

export class RunwayDto {
  @IsNumber()
  @Min(0)
  monthlyExpense: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyIncome?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  rateAnnual?: number;
}

export class ProjectDto {
  @IsNumber()
  @Min(0)
  principal: number;

  @IsNumber()
  @Min(0)
  monthlyContribution: number;

  @IsNumber()
  @Min(0)
  rateAnnual: number;

  @IsNumber()
  @Min(1)
  months: number;
}

export class RebalanceDto {
  @IsObject()
  target: Record<string, number>;
}
