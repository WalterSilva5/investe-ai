import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PromptRegistryService } from '../prompts/prompt-registry.service';
import { PromptEvalService } from './prompt-eval.service';
import { PromptTuneService } from './prompt-tune.service';
import { AGENT_PROFILES } from './agent-profiles';

@ApiTags('prompts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('prompts')
export class PromptAdminController {
  constructor(
    private readonly prompts: PromptRegistryService,
    private readonly evalRunner: PromptEvalService,
    private readonly tuneService: PromptTuneService,
  ) {}

  @Get('profiles')
  profiles() {
    return AGENT_PROFILES.map((profile) => ({ id: profile.id, name: profile.name, icon: profile.icon }));
  }

  @Get()
  list(@Query('profile') profile?: string) {
    return this.prompts.list(profile);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.prompts.get(id);
  }

  @Post()
  propose(
    @Body() body: { profileId?: string; systemPrompt?: string; notes?: string },
  ) {
    return this.prompts.propose(
      String(body.profileId || 'geral'),
      String(body.systemPrompt || ''),
      body.notes,
    );
  }

  @Post(':id/evaluate')
  evaluate(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.evalRunner.evaluate(id, tenantId);
  }

  @Post(':id/activate')
  activate(@Param('id') id: string) {
    return this.prompts.activate(id);
  }

  /** Dispara manualmente o ciclo de auto-ajuste (cron roda diário às 7h). */
  @Post('tune')
  tune(@TenantId() tenantId: string, @Query('profile') profile?: string) {
    return this.tuneService.tuneDaily(tenantId, profile);
  }

  /** Swarm: roda o ciclo para TODOS os perfis em paralelo. */
  @Post('swarm')
  swarm(@TenantId() tenantId: string, @Query('profiles') profiles?: string) {
    const ids = profiles
      ? profiles.split(',').map((item) => item.trim()).filter(Boolean)
      : undefined;
    return this.tuneService.tuneSwarm(tenantId, ids);
  }
}
