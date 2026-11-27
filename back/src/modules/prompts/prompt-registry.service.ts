import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AGENT_PROFILES } from '../ai/agent-profiles';

/**
 * Prompt registry: os prompts dos perfis deixam de ser só código e passam a
 * ter versões no banco. A versão `active` é a usada no chat; `candidate`
 * precisa de avaliação e aprovação humana para virar ativa.
 *
 * O código continua sendo a semente (version 1) e o fallback se o banco falhar.
 */
@Injectable()
export class PromptRegistryService implements OnModuleInit {
  private readonly logger = new Logger(PromptRegistryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedDefaults().catch((error) =>
      this.logger.warn(`Seed de prompts falhou: ${(error as Error).message}`),
    );
  }

  /** Garante versão 1 ativa para cada perfil definido no código. */
  async seedDefaults() {
    for (const profile of AGENT_PROFILES) {
      const existing = await this.prisma.agentPrompt.count({ where: { profileId: profile.id } });
      if (existing > 0) continue;
      await this.prisma.agentPrompt.create({
        data: {
          profileId: profile.id,
          version: 1,
          status: 'active',
          systemPrompt: profile.systemPrompt,
          notes: 'Versão inicial (código)',
          activatedAt: new Date(),
        },
      });
    }
  }

  /** Prompt ativo do perfil; cai para o código se não houver registro. */
  async activeFor(profileId: string): Promise<{ prompt: string; version: number }> {
    const row = await this.prisma.agentPrompt.findFirst({
      where: { profileId, status: 'active' },
      orderBy: { version: 'desc' },
    });
    if (row) return { prompt: row.systemPrompt, version: row.version };
    const fallback = AGENT_PROFILES.find((p) => p.id === profileId);
    return { prompt: fallback?.systemPrompt || '', version: 0 };
  }

  list(profileId?: string) {
    return this.prisma.agentPrompt.findMany({
      where: profileId ? { profileId } : {},
      orderBy: [{ profileId: 'asc' }, { version: 'desc' }],
      include: { runs: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
  }

  async get(id: string) {
    const row = await this.prisma.agentPrompt.findUnique({
      where: { id },
      include: { runs: { orderBy: { createdAt: 'desc' }, take: 5 } },
    });
    if (!row) throw new NotFoundException('Prompt não encontrado.');
    return row;
  }

  /** Cria uma versão candidata (não ativa) com o texto proposto. */
  async propose(profileId: string, systemPrompt: string, notes?: string) {
    const text = String(systemPrompt || '').trim();
    if (text.length < 40) {
      throw new NotFoundException('Prompt muito curto — escreva a instrução completa do perfil.');
    }
    const last = await this.prisma.agentPrompt.findFirst({
      where: { profileId },
      orderBy: { version: 'desc' },
    });
    const version = (last?.version ?? 0) + 1;
    return this.prisma.agentPrompt.create({
      data: {
        profileId,
        version,
        status: 'candidate',
        systemPrompt: text,
        notes: notes?.slice(0, 400),
      },
    });
  }

  /** Ativa a versão e arquiva a anterior (mantém histórico). */
  async activate(id: string) {
    const prompt = await this.get(id);
    await this.prisma.$transaction([
      this.prisma.agentPrompt.updateMany({
        where: { profileId: prompt.profileId, status: 'active' },
        data: { status: 'archived' },
      }),
      this.prisma.agentPrompt.update({
        where: { id },
        data: { status: 'active', activatedAt: new Date() },
      }),
    ]);
    return this.get(id);
  }

  /** Salva o resultado de uma avaliação (chamado pelo eval runner). */
  async saveEval(
    promptId: string,
    tenantId: string,
    score: number,
    results: unknown,
  ) {
    await this.prisma.$transaction([
      this.prisma.agentPrompt.update({
        where: { id: promptId },
        data: { evalScore: score, evalDetails: results as never },
      }),
      this.prisma.promptEvalRun.create({
        data: { promptId, tenantId, score, results: results as never },
      }),
    ]);
  }

  /** Nota da versão ativa (baseline para comparar candidatos). */
  async baseline(profileId: string): Promise<number | null> {
    const row = await this.prisma.agentPrompt.findFirst({
      where: { profileId, status: 'active' },
      orderBy: { version: 'desc' },
    });
    return row?.evalScore ?? null;
  }
}
