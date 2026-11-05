import { IsArray, IsOptional, IsString } from 'class-validator';

export class GenerateIdeasDto {
  @IsOptional()
  @IsString()
  focus?: string;

  @IsOptional()
  @IsArray()
  kinds?: string[];
}
