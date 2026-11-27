import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiProviderRegistry } from '../ai-provider/ai-provider.registry';
import { ChatMessage, OpenAICompatibleProvider } from '../ai-provider/openai-compatible.provider';
import { PromptRegistryService } from '../prompts/prompt-registry.service';
import { PortfoliosService } from '../portfolios/portfolios.service';
import { MacroService } from '../market/macro.service';
import { MemoriesService } from '../memories/memories.service';
import { AiToolsService } from './ai-tools.service';
import { AGENT_PROFILES } from './agent-profiles';
import { BASE_PROMPT } from './ai.service';
import { aggregate, EVAL_CASES, EvalAnswer, EvalCase, scoreAnswer } from './prompt-eval';

/**
 * Roda o conjunto dourado de perguntas contra um prompt candidato, usando o
 * mesmo loop de tools do chat, e salva a nota. Custa tokens: é ação manual.
 */
@Injectable()
export class PromptEvalService {
  private readonly logger = new Logger(PromptEvalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly prompts: PromptRegistryService,
    private readonly providers: AiProviderRegistry,
    private readonly tools: AiToolsService,
    private readonly portfolios: PortfoliosService,
    private readonly macro: MacroService,
    private readonly memories: MemoriesService,
  ) {}

  async evaluate(promptId: string, tenantId: string) {
    const prompt = await this.prompts.get(promptId);
    const profile = AGENT_PROFILES.find((p) => p.id === prompt.profileId) ?? AGENT_PROFILES[0];
    const allowedTools = profile.tools;
    const resolved = await this.providers.resolve(tenantId);

    const context = {
      portfolio: await this.portfolios.aiContext(tenantId).catch(() => null),
      macro: await this.macro.getMacro().catch(() => null),
      memories: await this.memories.top(tenantId).catch(() => []),
    };
    const system = `${BASE_PROMPT}\n\nPerfil ativo: ${profile.name}. Prompt v${prompt.version} (em avaliação).\n${prompt.systemPrompt}`;

    const cases = EVAL_CASES.slice(0, 5);
    const results: Array<{
      id: string;
      score: number;
      checks: Array<{ name: string; weight: number; ok: boolean; detail?: string }>;
      content: string;
      tools: string[];
    }> = [];
    for (const evalCase of cases) {
      const answer = await this.runCase(
        resolved.provider,
        resolved.model,
        system,
        context,
        evalCase,
        allowedTools,
        tenantId,
      );
      const scored = scoreAnswer(answer, evalCase);
      results.push({ ...scored, content: answer.content.slice(0, 1200), tools: answer.tools });
      this.logger.log(`Eval ${prompt.profileId} v${prompt.version} · ${evalCase.id}: ${scored.score}`);
    }

    const score = aggregate(results);
    const baseline = await this.prompts.baseline(prompt.profileId);
    const verdict =
      baseline == null
        ? 'sem baseline (versão ativa nunca foi avaliada)'
        : score > baseline + 2
          ? `melhor que o baseline (${baseline})`
          : score >= baseline - 2
            ? `empatado com o baseline (${baseline})`
            : `pior que o baseline (${baseline})`;

    await this.prompts.saveEval(promptId, tenantId, score, {
      results,
      baseline,
      verdict,
      model: resolved.model,
    });

    return { promptId, profileId: prompt.profileId, version: prompt.version, score, baseline, verdict, results };
  }

  /** Uma pergunta com o loop de tools (até 3 passos), igual ao chat. */
  private async runCase(
    provider: OpenAICompatibleProvider,
    model: string,
    system: string,
    context: Record<string, unknown>,
    evalCase: EvalCase,
    allowedTools: string[] | undefined,
    tenantId: string,
  ): Promise<EvalAnswer> {
    const definitions = this.tools.definitions();
    const tools = allowedTools?.length
      ? definitions.filter((def) => allowedTools.includes(def.function.name))
      : definitions;

    const messages: ChatMessage[] = [
      { role: 'system', content: system },
      { role: 'system', content: `Contexto (${new Date().toISOString()}): ${JSON.stringify(context)}` },
      { role: 'user', content: evalCase.question },
    ];
    const used: string[] = [];

    for (let step = 0; step < 3; step += 1) {
      const result = await provider.chat(messages, { model, temperature: 0.3, tools });
      if (!result.toolCalls.length) {
        return { content: result.content || '', tools: used };
      }
      messages.push({
        role: 'assistant',
        content: result.content || '',
        tool_calls: result.toolCalls.map((call) => ({
          id: call.id,
          type: 'function',
          function: { name: call.name, arguments: call.arguments },
        })),
      });
      for (const call of result.toolCalls) {
        let args: Record<string, unknown> = {};
        try {
          args = call.arguments ? (JSON.parse(call.arguments) as Record<string, unknown>) : {};
        } catch {
          args = {};
        }
        const execution = await this.tools.execute(call.name, args, tenantId);
        used.push(call.name);
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          name: call.name,
          content: JSON.stringify(execution.result),
        });
      }
    }

    // estourou os 3 passos: pede a resposta final sem tools
    const final = await provider.chat(messages, { model, temperature: 0.3 });
    return { content: final.content || '', tools: used };
  }
}
