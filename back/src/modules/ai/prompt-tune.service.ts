import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiProviderRegistry } from '../ai-provider/ai-provider.registry';
import { PromptRegistryService } from '../prompts/prompt-registry.service';
import { PromptEvalService } from './prompt-eval.service';
import { LearningService } from '../learning/learning.service';
import { BASE_PROMPT } from './ai.service';
import { AGENT_PROFILES } from './agent-profiles';
import { runWithConcurrency, summarizeSwarm, SwarmOutcome } from './swarm';

/** Margem mínima sobre o baseline para promoção automática. */
export const PROMOTE_MARGIN = 5;

/**
 * Decide a promoção automática: só ativa se superar o baseline com margem
 * e se todos os checks críticos (tool, frase proibida, promessa) passarem.
 */
export function shouldPromote(
  candidate: { score: number; results: Array<{ id: string; checks: Array<{ name: string; ok: boolean }> }> },
  baseline: number | null,
): { promote: boolean; reason: string } {
  if (baseline == null) {
    return { promote: false, reason: 'baseline ainda não avaliado — ativação fica para depois' };
  }
  if (candidate.score <= baseline + PROMOTE_MARGIN) {
    return { promote: false, reason: `não superou o baseline com margem (candidato ${candidate.score} × base ${baseline})` };
  }
  const critical = candidate.results.flatMap((result) => result.checks);
  const failedCritical = critical.filter(
    (check) =>
      (check.name.includes('tool') || check.name.includes('proibida') || check.name.includes('promessa')) &&
      !check.ok,
  );
  if (failedCritical.length) {
    return { promote: false, reason: `check crítico falhou: ${failedCritical.map((c) => c.name).join(', ')}` };
  }
  return {
    promote: true,
    reason: `superou o baseline com margem (${candidate.score} × ${baseline}) e passou nos checks críticos`,
  };
}

const TUNE_PROMPT = `Você é um engenheiro de prompts. Recebe o prompt ATUAL de um perfil de assistente de investimentos e o RELATÓRIO DE FALHAS medido (casos dourados que perderam pontos + taxas de acerto das regras).
Reescreva o prompt do perfil para corrigir as falhas apontadas, sem perder as regras existentes.
Diretrizes: seja específico e acionável; cite comportamento esperado em vez de adjetivos; mantenha o tamanho parecido (até 30% maior).
Responda APENAS o novo texto do prompt (sem markdown, sem comentários).`;

@Injectable()
export class PromptTuneService {
  private readonly logger = new Logger(PromptTuneService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly prompts: PromptRegistryService,
    private readonly providers: AiProviderRegistry,
    private readonly evalRunner: PromptEvalService,
    private readonly learning: LearningService,
  ) {}

  /**
   * Ciclo diário: escolhe um perfil (rotação), redige um candidato corrigindo
   * as falhas medidas, avalia e promove automaticamente só se superar o
   * baseline com margem. Também aciona manualmente via endpoint.
   */
  async tuneDaily(tenantId: string, profileId?: string) {
    const profile = this.pickProfile(profileId);
    if (!profile) return { skipped: 'perfil não encontrado' };

    const resolved = await this.providers.resolve(tenantId).catch((error) => {
      this.logger.warn(`Auto-ajuste sem provedor: ${(error as Error).message}`);
      return null;
    });
    if (!resolved) return { skipped: 'provedor de IA não configurado' };

    const active = await this.prompts.activeFor(profile.id);
    const baseline = await this.prompts.baseline(profile.id);
    let baselineScore = baseline;
    if (baselineScore == null) {
      // primeira rodada: mede a ativa para ter com o que comparar
      const activeRow = await this.prisma.agentPrompt.findFirst({
        where: { profileId: profile.id, status: 'active' },
        orderBy: { version: 'desc' },
      });
      if (activeRow) {
        const run = await this.evalRunner.evaluate(activeRow.id, tenantId);
        baselineScore = run.score;
      }
    }

    const failures = await this.collectFailures(profile.id);
    const ruleStats = await this.learning.promptStats(tenantId).catch(() => null);

    let draft: { content?: string | null } | null = null;
    for (let attempt = 0; attempt < 2 && !draft?.content?.trim(); attempt += 1) {
      if (attempt > 0) this.logger.warn('Auto-ajuste: repetindo rascunho vazio.');
      draft = await resolved.provider.chat(
        [
          { role: 'system', content: TUNE_PROMPT },
          {
            role: 'user',
            content: JSON.stringify({
              prompt_atual: active.prompt,
              falhas_medidas: failures,
              regras_do_app: ruleStats,
              diretrizes_fixas:
                'As regras do BASE_PROMPT (aviso único, sem recomendação de compra/venda, ceticismo fiscal) são obrigatórias e não podem ser removidas.',
            }),
          },
        ],
        { model: resolved.model, temperature: 0.4, maxTokens: 6000 },
      );
    }

    const draftContent = draft?.content || '';
    if (!draftContent.trim() || draftContent.trim().length < 40) {
      this.logger.warn('Auto-ajuste: rascunho vazio/curto.');
      return { profile: profile.id, skipped: 'rascunho vazio' };
    }

    const candidate = await this.prompts.propose(
      profile.id,
      draftContent,
      `auto-ajuste ${new Date().toISOString().slice(0, 10)} · falhas: ${failures.slice(0, 200)}`,
    );
    const evaluation = await this.evalRunner.evaluate(candidate.id, tenantId);
    const decision = shouldPromote(evaluation, baselineScore);

    if (decision.promote) {
      await this.prompts.activate(candidate.id);
      await this.prisma.agentPrompt.update({
        where: { id: candidate.id },
        data: { notes: `${candidate.notes} · PROMOVIDO AUTOMATICAMENTE (${decision.reason})` },
      });
    }

    await this.report(tenantId, {
      profile: profile.id,
      candidateVersion: candidate.version,
      score: evaluation.score,
      baseline: baselineScore,
      promoted: decision.promote,
      reason: decision.reason,
    });

    this.logger.log(
      `Auto-ajuste ${profile.id} v${candidate.version}: nota ${evaluation.score} (base ${baselineScore}) → ${
        decision.promote ? 'PROMOVIDO' : 'não promovido'
      }`,
    );

    return {
      profile: profile.id,
      candidateVersion: candidate.version,
      score: evaluation.score,
      baseline: baselineScore,
      promoted: decision.promote,
      reason: decision.reason,
    };
  }

  /**
   * Swarm: roda o ciclo de auto-ajuste para TODOS os perfis em paralelo
   * (concância limitada) e devolve um relatório único + Insight agregado.
   */
  async tuneSwarm(tenantId: string, profileIds?: string[], concurrency = 2) {
    const ids = profileIds?.length
      ? profileIds
      : AGENT_PROFILES.map((profile) => profile.id);
    const outcomes: SwarmOutcome[] = await runWithConcurrency(ids, concurrency, async (profileId) => {
      try {
        const result = (await this.tuneDaily(tenantId, profileId)) as {
          profile: string;
          candidateVersion?: number;
          score?: number;
          baseline?: number | null;
          promoted?: boolean;
          reason: string;
          skipped?: string;
        };
        return {
          profile: profileId,
          candidateVersion: result.candidateVersion,
          score: result.score,
          baseline: result.baseline ?? null,
          promoted: Boolean(result.promoted),
          reason: result.reason || 'ok',
          skipped: result.skipped,
        } as SwarmOutcome;
      } catch (error) {
        return {
          profile: profileId,
          promoted: false,
          reason: (error as Error).message,
          skipped: (error as Error).message,
        };
      }
    });

    const summary = summarizeSwarm(outcomes);

    await this.prisma.insight
      .create({
        data: {
          tenantId,
          category: 'GERAL',
          title:
            `Swarm de auto-ajuste: ${summary.promoted} promovido(s), ` +
            `${summary.candidates} candidato(s), ${summary.skipped} sem rodar`,
          content:
            `Perfis: ${ids.join(', ')}. ` +
            (summary.best
              ? `Melhor resultado: ${summary.best.profile} v${summary.best.candidateVersion} (nota ${summary.best.score}). `
              : '') +
            'Revisar detalhes em Prompts do agente.',
          providerId: 'self',
        },
      })
      .catch(() => undefined);

    return { summary, outcomes };
  }

  /** Rotação simples: um perfil por dia útil. */
  private pickProfile(profileId?: string) {
    if (profileId) return AGENT_PROFILES.find((p) => p.id === profileId) ?? null;
    const day = Math.floor(Date.now() / 86_400_000);
    return AGENT_PROFILES[day % AGENT_PROFILES.length];
  }

  /** Casos dourados com pontos perdidos, a partir da última avaliação do perfil. */
  private async collectFailures(profileId: string): Promise<string[]> {
    try {
      const rows = await this.prisma.agentPrompt.findMany({
        where: { profileId },
        orderBy: { version: 'desc' },
        take: 3,
      });
      const failures: string[] = [];
      for (const row of rows) {
        const details = row.evalDetails as
          | { results?: Array<{ id: string; score: number; checks: Array<{ name: string; ok: boolean; detail?: string }> }> }
          | null;
        for (const result of details?.results || []) {
          for (const check of result.checks || []) {
            if (!check.ok) {
              failures.push(`${result.id}: ${check.name} falhou${check.detail ? ` (${check.detail})` : ''}`);
            }
          }
        }
        if (failures.length) break;
      }
      return failures.length ? failures : ['nenhuma falha registrada nas últimas avaliações'];
    } catch {
      return ['sem histórico de avaliação ainda'];
    }
  }

  /** Deixa o resultado no feed de Insights (categoria GERAL) para revisão. */
  private async report(
    tenantId: string,
    data: {
      profile: string;
      candidateVersion: number;
      score: number;
      baseline: number | null;
      promoted: boolean;
      reason: string;
    },
  ) {
    await this.prisma.insight
      .create({
        data: {
          tenantId,
          category: 'GERAL',
          title: data.promoted
            ? `Auto-ajuste de prompt: v${data.candidateVersion} promovida (${data.profile})`
            : `Auto-ajuste de prompt: candidato v${data.candidateVersion} não promovido (${data.profile})`,
          content:
            `Nota ${data.score}/100 (baseline ${data.baseline ?? '—'}). ${data.reason}. ` +
            'A versão anterior fica arquivada e pode ser reativada em Prompts do agente.',
          providerId: 'self',
        },
      })
      .catch(() => undefined);
  }
}
