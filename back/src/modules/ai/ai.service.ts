import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiProviderRegistry } from '../ai-provider/ai-provider.registry';
import { ChatMessage } from '../ai-provider/openai-compatible.provider';
import { ChatDto } from './dto/chat.dto';

const SYSTEM_PROMPT = `Você é o assistente do wsi-invest-ai, uma ferramenta de análise de investimentos.
Responda em português do Brasil, de forma direta e didática.

Regras obrigatórias:
- Faça análise, explicação e comparação. NÃO recomende compra ou venda, NÃO preveja preço e NÃO prometa retorno.
- Nunca invente números. Se o dado não estiver disponível, diga que não tem.
- Quando citar um dado, informe a fonte e a data.
- Deixe claro que a resposta é educacional e não é recomendação de investimento.
- Você não executa ordens.
- Se a pergunta exigir dados da carteira e você não os tiver, peça ao usuário para cadastrar/abrir a carteira (as tools de carteira entram na próxima fase).`;

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: AiProviderRegistry,
  ) {}

  async chat(tenantId: string, userId: string, dto: ChatDto) {
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

    const history: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...conversation.messages.map((m) => ({
        role: m.role.toLowerCase() as 'system' | 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: dto.message },
    ];

    const result = await resolved.provider.chat(history, {
      model: resolved.model,
      temperature: dto.temperature,
    });

    await this.prisma.$transaction([
      this.prisma.message.create({
        data: { conversationId: conversation.id, role: 'USER', content: dto.message },
      }),
      this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: 'ASSISTANT',
          content: result.content,
          tokensIn: result.tokensIn,
          tokensOut: result.tokensOut,
        },
      }),
      this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { providerId: resolved.providerId, model: result.model },
      }),
      this.prisma.aiUsage.create({
        data: {
          tenantId,
          userId,
          providerId: resolved.providerId,
          model: result.model,
          tokensIn: result.tokensIn,
          tokensOut: result.tokensOut,
          task: 'chat',
        },
      }),
      this.prisma.auditEvent.create({
        data: {
          tenantId,
          userId,
          action: 'ai.chat',
          entity: 'conversation',
          entityId: conversation.id,
          metadata: {
            providerId: resolved.providerId,
            model: result.model,
            tokensIn: result.tokensIn,
            tokensOut: result.tokensOut,
          },
        },
      }),
    ]);

    return {
      conversationId: conversation.id,
      providerId: resolved.providerId,
      model: result.model,
      content: result.content,
      usage: { tokensIn: result.tokensIn, tokensOut: result.tokensOut },
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
}
