import { IsBoolean, IsIn, IsObject, IsOptional } from 'class-validator';

export class CreateAlertDto {
  @IsIn(['ALLOCATION_MAX', 'MACRO'])
  type: string;

  @IsObject()
  condition: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateAlertDto {
  @IsOptional()
  @IsObject()
  condition?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
