import { IsString } from 'class-validator';

export class Confirm2faDto {
  @IsString()
  code: string;
}
