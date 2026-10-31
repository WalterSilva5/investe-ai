import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class ImportStatementDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  institution?: string;

  @IsIn(['OFX', 'CSV'])
  format: string;

  @IsString()
  @MinLength(1)
  content: string;
}
