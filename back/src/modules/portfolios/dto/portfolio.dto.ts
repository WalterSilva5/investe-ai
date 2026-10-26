import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreatePortfolioDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdatePortfolioDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
