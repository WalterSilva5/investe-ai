import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { IsArray, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { PromptSimService } from './sim/prompt-sim.service';

class RunSimDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  symbols?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  classes?: string[];

  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(14)
  anchors?: number;

  @IsOptional()
  @IsString()
  model?: string;
}

/** Simulações (backtest de prompts por classe de ativo). Leitura livre; run é admin. */
@Controller('prompts/sim')
export class SimController {
  constructor(private readonly sim: PromptSimService) {}

  @Get('results')
  results(@Query('limit') limit?: string) {
    return this.sim.results(Number(limit) || 60);
  }

  @Get('best')
  best() {
    return this.sim.bestPerClass();
  }

  @Post('run')
  run(@Body() dto: RunSimDto) {
    return this.sim.run({
      symbols: dto.symbols,
      classes: dto.classes,
      anchors: dto.anchors,
      model: dto.model,
    });
  }
}
