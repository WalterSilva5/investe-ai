import { IsOptional, IsString, MinLength } from 'class-validator';

export class SaveCredentialDto {
  @IsOptional()
  @IsString()
  @MinLength(8)
  apiKey?: string;

  @IsOptional()
  @IsString()
  baseUrl?: string;

  @IsOptional()
  @IsString()
  model?: string;
}
