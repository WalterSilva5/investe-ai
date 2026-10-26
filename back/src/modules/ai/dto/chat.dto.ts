import { IsNumber, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class ChatDto {
  @IsString()
  @MinLength(1)
  message: string;

  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsOptional()
  @IsString()
  providerId?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  temperature?: number;
}
