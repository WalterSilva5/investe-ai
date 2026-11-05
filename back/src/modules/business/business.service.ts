import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiProviderRegistry } from '../ai-provider/ai-provider.registry';
import { BUSINESS_KINDS, findBusinessKind } from './business-catalog';
import { GenerateIdeasDto } from './dto/generate-ideas.dto';
import { UpsertProfileDto } from './dto/upsert-profile.dto';

const SYSTEM_PROMPT = `Você é um consultor de negócios que ajuda um profissional a transformar habilidades em negócios viáveis e éticos.

Regras:
- Use o perfil fornecido (skills, experiência, formação, idiomas, interesses, disponibilidade).
- Seja realista: não prometa renda, não prometa sucesso.
- Foque em VALIDAÇÃO BARATA antes de investir tempo/dinheiro.
- Considere o foco desejado e os tipos preferidos.
- Não sugira esquemas, golpes, exploração de pessoas ou práticas ilegais.
- Cada ideia deve ser acionável em 30/60/90 dias.

Responda APENAS um JSON array (sem markdown) com 3 a 5 objetos:
[
  {
    "kind": "slug do catálogo (freelance|produto|agencia|educacao|conteudo|opensource|b2b|internacional)",
    "title": "título curto",
    "summary": "2-4 frases",
    "fitScore": 0,
    "requiredSkills": ["..."],
    "whyFit": "por que combina com o perfil",
    "firstSteps": ["..."],
    "validation": ["experimentos baratos para validar a demanda"],
    "pricing": "como cobrar (modelo, não valor garantido)",
    "risks": ["..."],
    "timeline": "30/60/90 dias",
    "disclaimer": "conteúdo educacional, não é garantia de resultado"
  }
]`;

@Injectable()
export class BusinessService {
  private readonly logger = new Logger(BusinessService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: AiProviderRegistry,
  ) {}

  getProfile(tenantId: string) {
    return this.prisma.businessProfile.findUnique({ where: { tenantId } });
  }

  async upsertProfile(tenantId: string, dto: UpsertProfileDto) {
    const data = {
      headline: dto.headline ?? null,
      summary: dto.summary ?? null,
      skills: (dto.skills ?? []) as never,
      experience: (dto.experience ?? []) as never,
      education: (dto.education ?? []) as never,
      languages: (dto.languages ?? []) as never,
      certifications: (dto.certifications ?? []) as never,
      interests: (dto.interests ?? []) as never,
      location: dto.location ?? null,
      availability: dto.availability ?? null,
      incomeGoal: dto.incomeGoal != null ? dto.incomeGoal : null,
    };

    return this.prisma.businessProfile.upsert({
      where: { tenantId },
      create: { tenantId, ...data },
      update: data,
    });
  }

  catalog() {
    return BUSINESS_KINDS.map((kind) => ({
      slug: kind.slug,
      name: kind.name,
      icon: kind.icon,
      description: kind.description,
      requiredSkills: kind.requiredSkills,
      signals: kind.signals,
    }));
  }

  listIdeas(tenantId: string) {
    return this.prisma.businessIdea.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
  }

  async generateIdeas(tenantId: string, dto: GenerateIdeasDto) {
    const profile = await this.prisma.businessProfile.findUnique({ where: { tenantId } });
    if (!profile) {
      throw new BadRequestException('Preencha seu perfil profissional antes de gerar ideias.');
    }

    const resolved = await this.registry.resolve(tenantId);
    const result = await resolved.provider.chat(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            `Perfil profissional: ${JSON.stringify(profile)}`,
            `Foco desejado: ${dto.focus || 'geral (renda e crescimento)'}`,
            `Tipos preferidos: ${dto.kinds?.join(', ') || 'todos'}`,
            `Catálogo de tipos: ${JSON.stringify(this.catalog())}`,
          ].join('\n'),
        },
      ],
      { model: resolved.model, temperature: 0.5, maxTokens: 2200 },
    );

    const ideas = this.parseJson(result.content);
    if (!ideas.length) {
      throw new BadRequestException('Não foi possível gerar ideias. Tente novamente.');
    }

    const created: unknown[] = [];
    for (const idea of ideas.slice(0, 6)) {
      const kind = findBusinessKind(String(idea.kind || ''))?.slug || 'freelance';
      const fitScore = Number(idea.fitScore);
      created.push(
        await this.prisma.businessIdea.create({
          data: {
            tenantId,
            kind,
            title: String(idea.title || 'Ideia').slice(0, 180),
            summary: String(idea.summary || '').slice(0, 600),
            score: Number.isFinite(fitScore) ? Math.max(0, Math.min(100, Math.round(fitScore))) : 0,
            content: idea as never,
            providerId: resolved.providerId,
            model: resolved.model,
          },
        }),
      );
    }

    return { generated: created.length, ideas: created };
  }

  private parseJson(content: string): Array<Record<string, unknown>> {
    try {
      const trimmed = content
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/```\s*$/, '')
        .trim();
      const start = trimmed.indexOf('[');
      const end = trimmed.lastIndexOf(']');
      if (start === -1 || end === -1 || end <= start) return [];
      const parsed = JSON.parse(trimmed.slice(start, end + 1));
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item) => item && typeof item === 'object');
    } catch (error) {
      this.logger.warn(`Falha ao parsear ideias de negócio: ${(error as Error).message}`);
      return [];
    }
  }
}
