import { IsIn, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class CreateMemoryDto {
  @IsString()
  @MinLength(1)
  content: string;

  @IsOptional()
  @IsIn(['fact', 'decision', 'preference', 'episode', 'procedure', 'context'])
  kind?: string;

  @IsOptional()
  @IsString()
  tags?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  importance?: number;
}
