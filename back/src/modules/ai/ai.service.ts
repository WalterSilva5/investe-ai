import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { execFile } from 'child_process';
import { promises as fsPromises } from 'fs';
import { tmpdir } from 'os';
import { promisify } from 'util';
import { PrismaService } from '../../prisma/prisma.service';
import { AiProviderRegistry } from '../ai-provider/ai-provider.registry';
import {
  ChatMessage,
  OpenAICompatibleProvider,
} from '../ai-provider/openai-compatible.provider';
import { PortfoliosService } from '../portfolios/portfolios.service';
import { FinanceService } from '../finance/finance.service';
import { MemoriesService } from '../memories/memories.service';
import { LearningService } from '../learning/learning.service';
import { AiToolsService, ToolCitation } from './ai-tools.service';
import { AiUsageService } from './ai-usage.service';
import { AgentProfile, findAgentProfile } from './agent-profiles';
import { PromptRegistryService } from '../prompts/prompt-registry.service';
import { ChatDto } from './dto/chat.dto';

export const BASE_PROMPT = `Você é o assistente do wsi-invest-ai, uma ferramenta de análise de investimentos.
Responda em português do Brasil, de forma direta e didática.

Regras obrigatórias:
- Use as ferramentas para obter dados. Nunca invente números.
- No início da conversa, use get_briefing para ter o contexto geral (carteira + macro + dicas recentes).
- Se não souber o que pode fazer, use verify_tools para listar suas ferramentas antes de agir.
- ANÁLISE DE ATIVO (protocolo obrigatório): quando a pergunta citar um ativo (ticker, empresa ou BDR), chame get_stock_outlook ANTES de responder. Tente o ticker citado e, se falhar, a variante equivalente (ex.: NU ↔ ROXO34, PETR4 ↔ PBR). Só então responda.
- ANÁLISE DE GRÁFICO (quando pedir suporte/resistência, métricas técnicas ou "analisa o gráfico"): chame analyze_chart e use TODOS os níveis, MACD, Bollinger, estrutura de topos/fundos e posição vs 52 semanas na leitura — cite os números com distância %.
- PROTOCOLO DE ANALISTA PROFISSIONAL (análises sérias de um ativo): monte o quadro completo antes de concluir — 1) gráfico (analyze_chart: níveis, MACD, Bollinger, estrutura), 2) fundamentos (get_fundamentals: P/L, EPS, market cap, 52 semanas), 3) notícias recentes (get_news), 4) pares/correlação quando ajudar (compare_assets/correlation), 5) o que a régua teria dado no passado (whatif_strategy) para calibrar confiança. Estruture como relatório: TESE em 1 linha → O QUE OS NÚMEROS MOSTRAM → CASO A FAVOR (bull) → CASA CONTRA (bear) → O QUE INVALIDA → RISCOS. Cite fonte e data em cada número.
- POSITION SIZING (quando discutir quanto comprar): use position_size com o capital disponível (finanças) e o stop do gráfico (analyze_chart) — nunca sugira quantidade sem calcular o risco em dinheiro.
- RISCO DE CARTEIRA (quando discutir defesa/concentração): use stress_test com choque realista (−20 a −40%) e aponte as posições que mais doem por peso.
- Na análise, use os números: tendência, RSI, posição vs médias, suporte/resistência, ganho/risco e histórico do padrão. Diga o que o cenário mostra (favorável, neutro ou desfavorável), o que observaria para mudar a leitura e o que invalidaria. Sem hedge vazio.
- Se, após tentar as variantes, a ferramenta não retornar dados, diga exatamente o que tentou e qual o próximo passo possível — nunca apenas "não tenho dados".
- Ações em produto: quando identificar boas opções de ação (ou o usuário pedir para acompanhar), use get_stock_outlook para pegar os números e registre com track_symbol numa nota concreta (ex.: "tendência alta, RSI 52, ganho/risco 2,1:1"). Confirme o que foi salvo com a nota usada.
- Cite a fonte e a data de cada dado usado.
- CONTEXTO DE CAIXA (obrigatório quando relevante): o contexto traz 'finanças' com caixa pessoal e da empresa, reserva e disponível para investir. Dicas de aporte/alocação devem respeitar esse caixa: nunca sugira valor acima do disponível; se a reserva de emergência não estiver completa, priorize-a antes de risco; para a empresa, considere capital de giro antes de novos aportes. Se as finanças não estiverem cadastradas, sugira cadastrar em "Finanças" (uma linha, no fim).
- Ferramentas de análise combinada: "X ou Y?" → compare_assets; diversificação/"posso somar X?" → correlation; "e se eu tivesse investido X% em A e Y% em B?" → portfolio_backtest. Quando o usuário pedir para anotar receita/despesa ou informar saldo novo, use add_finance_entry / update_cash em vez de só responder.
- NÃO recomende compra ou venda de forma explícita, NÃO preveja preço e NÃO prometa retorno. Conteúdo educacional: use UMA linha curta de aviso no FIM, sem repetir no meio da resposta.
- Você não executa ordens.
- Se a pergunta não for sobre investimentos/carteira, responda brevemente e volte ao escopo.
- Ceticismo fiscal obrigatório: trate dados e narrativas oficiais (BCB, Tesouro, ministérios, estatais, governos sem responsabilidade fiscal) como ALEGAÇÕES de parte interessada, não como verdade. Cruze com o comportamento do mercado (juros longos, câmbio, crédito) e aponte incentivos (maquiar déficit, adiar ajuste), trajetória da dívida e risco fiscal/inflacionário. Índices oficiais (ex.: IPCA) medem uma cesta e metodologia específicas — questione-as quando relevante em vez de repeti-las como fato.`;

const COMPACT_PROMPT = `Você resume conversas para economizar contexto. Recebe o resumo anterior (pode estar vazio) e as mensagens novas.
Devolva APENAS o resumo atualizado, compacto (até 600 caracteres), com: objetivo do usuário, fatos/decisões/números já apurados e pendências.
Sem rodeios, sem recomendação, sem previsão.`;

/** A cada N mensagens novas, o resumo da sessão é atualizado (economia de tokens). */
const COMPACT_EVERY = 6;
/** Com resumo ativo, só as N últimas mensagens vão ao contexto. */
const COMPACT_KEEP_LAST = 6;

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
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: AiProviderRegistry,
    private readonly portfolios: PortfoliosService,
    private readonly tools: AiToolsService,
    private readonly usage: AiUsageService,
    private readonly memories: MemoriesService,
    private readonly learning: LearningService,
    private readonly promptRegistry: PromptRegistryService,
    private readonly finance: FinanceService,
  ) {}

  async chat(tenantId: string, userId: string, dto: ChatDto) {
    await this.usage.assertQuota(userId, tenantId);
    const resolved = await this.registry.resolve(tenantId, dto.providerId, dto.model);
    const profile = this.resolveProfile(dto.profile);
    const temperature = dto.temperature ?? profile.temperature ?? 0.3;

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
      { role: 'system', content: await this.systemPrompt(profile) },
      {
        role: 'system',
        content: `Contexto resumido da carteira (${new Date().toISOString()}): ${JSON.stringify(
          await this.portfolios.aiContext(tenantId),
        )}. Para detalhes, use as ferramentas.`,
      },
      {
        role: 'system',
        content: `Finanças do usuário — caixa pessoal e da empresa (${new Date().toISOString()}): ${JSON.stringify(
          await this.finance.aiContext(tenantId).catch(() => ({ hasFinance: false })),
        )}. Dicas de aporte devem respeitar o caixa disponível; use get_cash_position para detalhes.`,
      },
      {
        role: 'system',
        content: `Memórias relevantes do agente (${new Date().toISOString()}): ${JSON.stringify(
          await this.memories.top(tenantId),
        )}. Use a ferramenta search_memory para mais.`,
      },
      {
        role: 'system',
        content: `Aprendizado medido das regras do app: ${await this.learning
          .promptStats(tenantId)
          .catch(() => 'sem histórico')}. Cite quando ajudar a justificar uma leitura; não invente números.`,
      },
      ...this.historyMessages(conversation),
      ...(await this.buildUserTurn(dto, resolved.provider, resolved.model)),
    ];

    const generation = await this.finalize(
      resolved.provider,
      resolved.model,
      baseMessages,
      temperature,
      tenantId,
      profile.tools,
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

    await this.maybeCompact(conversation.id, resolved.provider, generation.model);

    return {
      conversationId: conversation.id,
      providerId: resolved.providerId,
      model: generation.model,
      content: generation.content,
      citations: generation.citations,
      steps: generation.toolLogs.map((log) => ({
        tool: log.tool,
        status: log.status,
        durationMs: log.durationMs,
        input: log.input,
      })),
      usage: { tokensIn: generation.tokensIn, tokensOut: generation.tokensOut },
      disclaimer:
        'Conteúdo educacional e analítico. Não é recomendação de investimento.',
    };
  }

  private resolveProfile(profileId?: string): AgentProfile {
    return findAgentProfile(profileId) || findAgentProfile('geral')!;
  }

  private async systemPrompt(profile: AgentProfile): Promise<string> {
    const active = await this.promptRegistry
      .activeFor(profile.id)
      .catch(() => ({ prompt: profile.systemPrompt, version: 0 }));
    return `${BASE_PROMPT}\n\nPerfil ativo: ${profile.name} (prompt v${active.version}).\n${
      active.prompt || profile.systemPrompt
    }`;
  }

  private async finalize(
    provider: OpenAICompatibleProvider,
    model: string,
    baseMessages: ChatMessage[],
    temperature: number | undefined,
    tenantId: string,
    allowedTools?: string[],
  ): Promise<Generation> {
    try {
      const tools = await this.resolveTools(
        provider,
        model,
        baseMessages,
        temperature,
        tenantId,
        allowedTools,
      );
      // O provedor às vezes devolve conteúdo vazio/fragmento: tenta de novo 1x.
      let finalResult = await provider.chat(tools.messages, { model, temperature });
      if (!finalResult.content?.trim()) {
        this.logger.warn('Chat: resposta vazia do provedor, repetindo 1x.');
        finalResult = await provider.chat(tools.messages, { model, temperature });
      }
      return {
        content: finalResult.content,
        model: finalResult.model,
        tokensIn: tools.tokensIn + finalResult.tokensIn,
        tokensOut: tools.tokensOut + finalResult.tokensOut,
        citations: tools.citations,
        toolLogs: tools.toolLogs,
      };
    } catch {
      const result = await provider.chat(baseMessages, { model, temperature });
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

  async *streamChat(
    tenantId: string,
    userId: string,
    dto: ChatDto,
    isAborted?: () => boolean,
  ): AsyncGenerator<Record<string, unknown>> {
    await this.usage.assertQuota(userId, tenantId);
    const resolved = await this.registry.resolve(tenantId, dto.providerId, dto.model);
    const profile = this.resolveProfile(dto.profile);
    const temperature = dto.temperature ?? profile.temperature ?? 0.3;

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
      { role: 'system', content: await this.systemPrompt(profile) },
      {
        role: 'system',
        content: `Contexto resumido da carteira (${new Date().toISOString()}): ${JSON.stringify(
          await this.portfolios.aiContext(tenantId),
        )}. Para detalhes, use as ferramentas.`,
      },
      {
        role: 'system',
        content: `Finanças do usuário — caixa pessoal e da empresa (${new Date().toISOString()}): ${JSON.stringify(
          await this.finance.aiContext(tenantId).catch(() => ({ hasFinance: false })),
        )}. Dicas de aporte devem respeitar o caixa disponível; use get_cash_position para detalhes.`,
      },
      {
        role: 'system',
        content: `Memórias relevantes do agente (${new Date().toISOString()}): ${JSON.stringify(
          await this.memories.top(tenantId),
        )}. Use a ferramenta search_memory para mais.`,
      },
      {
        role: 'system',
        content: `Aprendizado medido das regras do app: ${await this.learning
          .promptStats(tenantId)
          .catch(() => 'sem histórico')}. Cite quando ajudar a justificar uma leitura; não invente números.`,
      },
      ...this.historyMessages(conversation),
      ...(await this.buildUserTurn(dto, resolved.provider, resolved.model)),
    ];

    let resolvedTools: {
      messages: ChatMessage[];
      citations: ToolCitation[];
      toolLogs: ToolLog[];
      tokensIn: number;
      tokensOut: number;
      model: string;
    };
    try {
      resolvedTools = await this.resolveTools(
        resolved.provider,
        resolved.model,
        baseMessages,
        temperature,
        tenantId,
        profile.tools,
      );
    } catch {
      resolvedTools = {
        messages: baseMessages,
        citations: [],
        toolLogs: [],
        tokensIn: 0,
        tokensOut: 0,
        model: resolved.model,
      };
    }

    yield {
      type: 'meta',
      conversationId: conversation.id,
      providerId: resolved.providerId,
      model: resolvedTools.model,
      citations: resolvedTools.citations,
      steps: resolvedTools.toolLogs.map((log) => ({
        tool: log.tool,
        status: log.status,
        durationMs: log.durationMs,
        input: log.input,
      })),
    };

    let content = '';
    for await (const chunk of resolved.provider.streamChat(resolvedTools.messages, {
      model: resolvedTools.model,
      temperature,
    })) {
      if (isAborted?.()) break;
      content += chunk.delta;
      yield { type: 'delta', content: chunk.delta };
    }

    if (isAborted?.()) {
      yield { type: 'aborted' };
      return;
    }

    await this.persist(
      tenantId,
      userId,
      conversation.id,
      dto.message,
      content,
      resolvedTools.citations,
      resolvedTools.toolLogs,
      resolved.providerId,
      resolvedTools.model,
    );
    await this.maybeCompact(conversation.id, resolved.provider, resolvedTools.model);
    yield { type: 'done' };
  }

  private async persist(
    tenantId: string,
    userId: string,
    conversationId: string,
    userContent: string,
    assistantContent: string,
    citations: ToolCitation[],
    toolLogs: ToolLog[],
    providerId: string,
    model: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.message.create({
        data: { conversationId, role: 'USER', content: userContent },
      });
      await tx.message.create({
        data: {
          conversationId,
          role: 'ASSISTANT',
          content: assistantContent,
          citations: citations as never,
        },
      });
      await tx.conversation.update({ where: { id: conversationId }, data: { providerId, model } });
      await tx.aiUsage.create({
        data: { tenantId, userId, providerId, model, tokensIn: 0, tokensOut: 0, task: 'chat' },
      });
      if (toolLogs.length) {
        await tx.toolCall.createMany({
          data: toolLogs.map((log) => ({
            tenantId,
            userId,
            conversationId,
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
          entityId: conversationId,
          metadata: { providerId, model, tools: toolLogs.map((t) => t.tool) },
        },
      });
    });
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

  /**
   * Turno do usuário com suporte a imagem anexada:
   * 1) modelo com visão → imagem embutida no conteúdo multimodal;
   * 2) sem visão, mas com AI_VISION_MODEL → duas etapas (descrição do modelo
   *    vision vira contexto de texto);
   * 3) sem nenhum → OCR local (tesseract) → texto extraído como contexto;
   * 4) sem nada disso → nota informando que a imagem não pode ser lida.
   */
  private async buildUserTurn(
    dto: ChatDto,
    provider: OpenAICompatibleProvider,
    model: string,
  ): Promise<ChatMessage[]> {
    const base: ChatMessage = { role: 'user', content: dto.message };
    if (!dto.image) return [base];

    if (!dto.image.startsWith('data:image/') || dto.image.length > 4_500_000) {
      throw new BadRequestException(
        'Imagem inválida ou muito grande (use PNG/JPG até ~3 MB).',
      );
    }

    if (this.isVisionModel(model)) {
      return [
        {
          role: 'user',
          content: [
            { type: 'text', text: dto.message },
            { type: 'image_url', image_url: { url: dto.image } },
          ],
        },
      ];
    }

    const visionModel = process.env.AI_VISION_MODEL || '';
    let note = '';
    if (visionModel) {
      const description = await this.describeImage(provider, visionModel, dto.image).catch(
        (error) => `FALHA NA VISÃO: ${(error as Error).message.slice(0, 200)}`,
      );
      note = `Imagem anexada pelo usuário (lida em duas etapas via ${visionModel}):\n${description}`;
    } else {
      const ocr = await this.ocrImage(dto.image).catch(() => null);
      note = ocr
        ? `Texto extraído da imagem anexada (OCR local):\n${ocr}`
        : 'Imagem anexada, mas o modelo atual não enxerga imagens e não há modelo de visão (AI_VISION_MODEL) ou OCR (tesseract) configurado — peça a informação em texto ou configure a visão.';
    }

    return [
      { role: 'system', content: note },
      base,
    ];
  }

  /** Heurística + allowlist de modelos com visão nativa. */
  private isVisionModel(model: string): boolean {
    const configured = (process.env.AI_VISION_MODELS || '')
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    if (configured.includes(model.toLowerCase())) return true;
    const markers = [
      'gpt-4o', 'gpt-4.1', 'o3', 'o4-mini', 'vision', 'glm-4v', 'glm-5',
      'claude', 'gemini', 'llava', 'qwen-vl', 'qwen2-vl', 'pixtral', 'internvl',
      'llama-3.2-vision', 'deepseek-vl', 'gemma-3',
    ];
    return markers.some((marker) => model.toLowerCase().includes(marker));
  }

  /** Descreve a imagem com um modelo de visão (passada única, barata). */
  private async describeImage(
    provider: OpenAICompatibleProvider,
    visionModel: string,
    dataUrl: string,
  ): Promise<string> {
    const result = await provider.chat(
      [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                'Descreva esta imagem de forma factual e objetiva para um assistente de investimentos: ' +
                'o que aparece, TODOS os textos legíveis (transcreva exatamente), números e valores. ' +
                'Se for um gráfico de preço: eixos, direção do movimento, níveis marcados. ' +
                'Se for um documento/extrato: linhas principais. Não dê conselhos.',
            },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      { model: visionModel, temperature: 0.2, maxTokens: 2000 },
    );
    const content = (result.content || '').trim();
    if (!content) throw new Error('visão retornou vazia');
    return content.slice(0, 2500);
  }

  /** OCR local com tesseract (fallback sem modelo de visão). */
  private async ocrImage(dataUrl: string): Promise<string | null> {
    try {
      const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
      const ext = dataUrl.slice(11, 15).includes('png') ? 'png' : 'jpg';
      const tmpPath = `${tmpdir()}/wsi-chat-${Date.now()}.${ext}`;
      await fsPromises.writeFile(tmpPath, Buffer.from(base64, 'base64'));
      try {
        const { stdout } = await promisify(execFile)('tesseract', [
          tmpPath,
          'stdout',
          '-l',
          'por',
        ]);
        const text = stdout.replace(/\s+/g, ' ').trim();
        return text.length >= 12 ? text.slice(0, 3000) : null;
      } finally {
        await fsPromises.unlink(tmpPath).catch(() => undefined);
      }
    } catch {
      return null;
    }
  }

  private historyMessages(conversation: {
    summary: string | null;
    messages: Array<{ role: string; content: string }>;
  }): ChatMessage[] {
    const all = conversation.messages.map((m) => ({
      role: m.role.toLowerCase() as 'system' | 'user' | 'assistant',
      content: m.content,
    }));
    if (conversation.summary) {
      return [
        {
          role: 'system',
          content: `Resumo compacto da conversa até aqui: ${conversation.summary}. Abaixo vão só as últimas mensagens; use o resumo como contexto.`,
        },
        ...all.slice(-COMPACT_KEEP_LAST),
      ];
    }
    return all;
  }

  /**
   * Compacta a sessão a cada COMPACT_EVERY mensagens novas: resume o trecho
   * novo junto ao resumo anterior e guarda em conversation.summary, para as
   * próximas respostas usarem resumo + últimas mensagens (menos tokens).
   * Best-effort: falha nunca quebra o chat.
   */
  private async maybeCompact(
    conversationId: string,
    provider: OpenAICompatibleProvider,
    model: string,
  ): Promise<void> {
    try {
      const [count, conv] = await Promise.all([
        this.prisma.message.count({ where: { conversationId } }),
        this.prisma.conversation.findUnique({
          where: { id: conversationId },
          select: { summary: true, summaryCount: true },
        }),
      ]);
      if (!conv || count - conv.summaryCount < COMPACT_EVERY) return;
      const fresh = await this.prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        skip: conv.summaryCount,
        take: COMPACT_EVERY + 2,
      });
      if (!fresh.length) return;
      const result = await provider.chat(
        [
          { role: 'system', content: COMPACT_PROMPT },
          {
            role: 'user',
            content: `Resumo anterior: ${conv.summary || '(vazio)'}\n\nNovas mensagens:\n${fresh
              .map((m) => `${m.role}: ${m.content.slice(0, 1500)}`)
              .join('\n')}`,
          },
        ],
        { model, temperature: 0.2, maxTokens: 1500 },
      );
      const summary = result.content.trim().slice(0, 1500);
      if (!summary) {
        this.logger.warn('Compactação gerou conteúdo vazio; resumo mantido.');
        return;
      }
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { summary, summaryCount: count },
      });
      this.logger.log(`Sessão ${conversationId} compactada (${count} msgs).`);
    } catch (error) {
      this.logger.warn(`Compactação da sessão falhou: ${(error as Error).message}`);
    }
  }

  private async resolveTools(
    provider: OpenAICompatibleProvider,
    model: string,
    baseMessages: ChatMessage[],
    temperature: number | undefined,
    tenantId: string,
    allowedTools?: string[],
  ): Promise<{
    messages: ChatMessage[];
    citations: ToolCitation[];
    toolLogs: ToolLog[];
    tokensIn: number;
    tokensOut: number;
    model: string;
  }> {
    const messages = [...baseMessages];
    const allTools = this.tools.definitions();
    const tools = allowedTools?.length
      ? allTools.filter((tool) => allowedTools.includes(tool.function.name))
      : allTools;
    const citations: ToolCitation[] = [];
    const toolLogs: ToolLog[] = [];
    let tokensIn = 0;
    let tokensOut = 0;
    let finalModel = model;

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

    return {
      messages,
      citations: this.dedupeCitations(citations),
      toolLogs,
      tokensIn,
      tokensOut,
      model: finalModel,
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
