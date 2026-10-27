import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiProviderRegistry } from '../ai-provider/ai-provider.registry';
import {
  ChatMessage,
  OpenAICompatibleProvider,
} from '../ai-provider/openai-compatible.provider';
import { PortfoliosService } from '../portfolios/portfolios.service';
import { AiToolsService, ToolCitation } from './ai-tools.service';
import { AiUsageService } from './ai-usage.service';
import { ChatDto } from './dto/chat.dto';

const SYSTEM_PROMPT = `Você é o assistente do wsi-invest-ai, uma ferramenta de análise de investimentos.
Responda em português do Brasil, de forma direta e didática.

Regras obrigatórias:
- Use as ferramentas para obter dados da carteira, macro e renda fixa. Nunca invente números.
- Se a ferramenta não retornar o dado, diga que não tem.
- Cite a fonte e a data de cada dado usado.
- NÃO recomende compra ou venda, NÃO preveja preço e NÃO prometa retorno.
- Deixe claro que a resposta é educacional e não é recomendação de investimento.
- Você não executa ordens.
- Se a pergunta não for sobre investimentos/carteira, responda brevemente e volte ao escopo.`;

interface ToolLog {
  tool: string;
  input: Record<string, unknown>;
  output: unknown;
  durationMs: number;
  status: string;
}

interface Generation {
  content: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  citations: ToolCitation[];
  toolLogs: ToolLog[];
}

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: AiProviderRegistry,
    private readonly portfolios: PortfoliosService,
    private readonly tools: AiToolsService,
    private readonly usage: AiUsageService,
  ) {}

  async chat(tenantId: string, userId: string, dto: ChatDto) {
    await this.usage.assertQuota(userId, tenantId);
    const resolved = await this.registry.resolve(tenantId, dto.providerId, dto.model);

    let conversation = dto.conversationId
      ? await this.prisma.conversation.findUnique({
          where: { id: dto.conversationId },
          include: { messages: { orderBy: { createdAt: 'asc' }, take: 20 } },
        })
      : null;

    if (dto.conversationId && !conversation) {
      throw new NotFoundException('Conversa não encontrada.');
    }
    if (conversation && conversation.tenantId !== tenantId) {
      throw new ForbiddenException('Conversa de outro tenant.');
    }

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          tenantId,
          userId,
          title: dto.message.slice(0, 60),
          providerId: resolved.providerId,
          model: resolved.model,
        },
        include: { messages: true },
      });
    }

    const baseMessages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'system',
        content: `Contexto resumido da carteira (${new Date().toISOString()}): ${JSON.stringify(
          await this.portfolios.aiContext(tenantId),
        )}. Para detalhes, use as ferramentas.`,
      },
      ...conversation.messages.map((m) => ({
        role: m.role.toLowerCase() as 'system' | 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: dto.message },
    ];

    const generation = await this.generate(
      resolved.provider,
      resolved.model,
      baseMessages,
      dto.temperature,
      tenantId,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.message.create({
        data: { conversationId: conversation!.id, role: 'USER', content: dto.message },
      });
      await tx.message.create({
        data: {
          conversationId: conversation!.id,
          role: 'ASSISTANT',
          content: generation.content,
          citations: generation.citations as never,
          tokensIn: generation.tokensIn,
          tokensOut: generation.tokensOut,
        },
      });
      await tx.conversation.update({
        where: { id: conversation!.id },
        data: { providerId: resolved.providerId, model: generation.model },
      });
      await tx.aiUsage.create({
        data: {
          tenantId,
          userId,
          providerId: resolved.providerId,
          model: generation.model,
          tokensIn: generation.tokensIn,
          tokensOut: generation.tokensOut,
          task: 'chat',
        },
      });
      if (generation.toolLogs.length) {
        await tx.toolCall.createMany({
          data: generation.toolLogs.map((log) => ({
            tenantId,
            userId,
            conversationId: conversation!.id,
            tool: log.tool,
            input: log.input as never,
            output: log.output as never,
            durationMs: log.durationMs,
            status: log.status,
          })),
        });
      }
      await tx.auditEvent.create({
        data: {
          tenantId,
          userId,
          action: 'ai.chat',
          entity: 'conversation',
          entityId: conversation!.id,
          metadata: {
            providerId: resolved.providerId,
            model: generation.model,
            tokensIn: generation.tokensIn,
            tokensOut: generation.tokensOut,
            tools: generation.toolLogs.map((t) => t.tool),
          },
        },
      });
    });

    return {
      conversationId: conversation.id,
      providerId: resolved.providerId,
      model: generation.model,
      content: generation.content,
      citations: generation.citations,
      usage: { tokensIn: generation.tokensIn, tokensOut: generation.tokensOut },
      disclaimer:
        'Conteúdo educacional e analítico. Não é recomendação de investimento.',
    };
  }

  listConversations(tenantId: string, userId: string) {
    return this.prisma.conversation.findMany({
      where: { tenantId, userId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, providerId: true, model: true, updatedAt: true },
    });
  }

  async getConversation(tenantId: string, userId: string, id: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!conversation) throw new NotFoundException('Conversa não encontrada.');
    if (conversation.tenantId !== tenantId || conversation.userId !== userId) {
      throw new ForbiddenException('Sem acesso a esta conversa.');
    }
    return conversation;
  }

  private async generate(
    provider: OpenAICompatibleProvider,
    model: string,
    messages: ChatMessage[],
    temperature: number | undefined,
    tenantId: string,
  ): Promise<Generation> {
    try {
      return await this.generateWithTools(provider, model, messages, temperature, tenantId);
    } catch {
      const result = await provider.chat(messages, { model, temperature });
      return {
        content: result.content,
        model: result.model,
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
        citations: [],
        toolLogs: [],
      };
    }
  }

  private async generateWithTools(
    provider: OpenAICompatibleProvider,
    model: string,
    baseMessages: ChatMessage[],
    temperature: number | undefined,
    tenantId: string,
  ): Promise<Generation> {
    const messages = [...baseMessages];
    const tools = this.tools.definitions();
    const citations: ToolCitation[] = [];
    const toolLogs: ToolLog[] = [];
    let tokensIn = 0;
    let tokensOut = 0;
    let finalModel = model;
    let content = '';

    for (let step = 0; step < 4; step += 1) {
      const result = await provider.chat(messages, {
        model,
        temperature,
        tools,
      });
      tokensIn += result.tokensIn;
      tokensOut += result.tokensOut;
      finalModel = result.model;

      if (!result.toolCalls.length) {
        content = result.content;
        break;
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
        const started = Date.now();
        let args: Record<string, unknown> = {};
        try {
          args = call.arguments ? (JSON.parse(call.arguments) as Record<string, unknown>) : {};
        } catch {
          args = {};
        }
        const execution = await this.tools.execute(call.name, args, tenantId);
        const durationMs = Date.now() - started;

        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          name: call.name,
          content: JSON.stringify(execution.result),
        });

        if (execution.citation) citations.push(execution.citation);
        toolLogs.push({
          tool: call.name,
          input: args,
          output: execution.result,
          durationMs,
          status: 'ok',
        });
      }
    }

    if (!content) {
      content =
        'Não consegui concluir a análise com os dados disponíveis. Tente reformular a pergunta.';
    }

    return {
      content,
      model: finalModel,
      tokensIn,
      tokensOut,
      citations: this.dedupeCitations(citations),
      toolLogs,
    };
  }

  private dedupeCitations(citations: ToolCitation[]): ToolCitation[] {
    const seen = new Set<string>();
    return citations.filter((c) => {
      const key = `${c.tool}:${c.source}:${c.asOf}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
