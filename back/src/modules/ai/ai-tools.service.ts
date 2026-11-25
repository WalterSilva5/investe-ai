import { BadRequestException, Injectable } from '@nestjs/common';
import { FixedIncomeService } from '../fixed-income/fixed-income.service';
import { DocumentsService } from '../documents/documents.service';
import { MemoriesService } from '../memories/memories.service';
import { AnalysisService } from '../analysis/analysis.service';
import { MacroService } from '../market/macro.service';
import { PortfoliosService } from '../portfolios/portfolios.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ToolDefinition } from '../ai-provider/openai-compatible.provider';
import { toolsForProfile } from './agent-profiles';

export interface ToolCitation {
  tool: string;
  source: string;
  asOf: string;
}

export interface ToolExecution {
  result: unknown;
  citation?: ToolCitation;
}

@Injectable()
export class AiToolsService {
  constructor(
    private readonly portfolios: PortfoliosService,
    private readonly fixedIncome: FixedIncomeService,
    private readonly macroService: MacroService,
    private readonly documents: DocumentsService,
    private readonly memories: MemoriesService,
    private readonly analysis: AnalysisService,
    private readonly prisma: PrismaService,
  ) {}

  definitions(): ToolDefinition[] {
    return [
      {
        type: 'function',
        function: {
          name: 'get_portfolio_summary',
          description:
            'Resumo da carteira padrão do usuário: patrimônio, investido, resultado, rentabilidade e alocação por tipo.',
          parameters: { type: 'object', properties: {}, required: [] },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_positions',
          description:
            'Posições da carteira padrão: ativo, quantidade, preço médio, valor atual e resultado.',
          parameters: { type: 'object', properties: {}, required: [] },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_allocation',
          description: 'Alocação da carteira por tipo de ativo e por ativo.',
          parameters: { type: 'object', properties: {}, required: [] },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_macro',
          description: 'Selic, IPCA e CDI atuais, com fonte e data (BCB).',
          parameters: { type: 'object', properties: {}, required: [] },
        },
      },
      {
        type: 'function',
        function: {
          name: 'search_documents',
          description:
            'Busca nas notas/documentos do usuário por palavras-chave. Use para recuperar decisões, planos e anotações.',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Termo de busca' },
            },
            required: ['query'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'create_note',
          description:
            'Salva uma anotação no Diário do usuário (decisão, fato, ideia, caso observado). Use quando o usuário pedir para anotar/registrar/guardar algo.',
          parameters: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Título curto' },
              body: { type: 'string', description: 'Conteúdo da anotação' },
              tags: { type: 'string', description: 'Tags separadas por vírgula (opcional)' },
            },
            required: ['title', 'body'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'remember',
          description:
            'Grava uma memória duradoura (fato, decisão, preferência, procedimento) para usar em conversas futuras.',
          parameters: {
            type: 'object',
            properties: {
              content: { type: 'string' },
              kind: {
                type: 'string',
                enum: ['fact', 'decision', 'preference', 'episode', 'procedure', 'context'],
              },
              tags: { type: 'string' },
              importance: { type: 'integer' },
            },
            required: ['content'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'search_memory',
          description: 'Busca nas memórias do agente por palavras-chave.',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Termo de busca' },
            },
            required: ['query'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'project_runway',
          description:
            'Calcula por quantos meses o patrimônio atual sustenta uma despesa mensal (runway).',
          parameters: {
            type: 'object',
            properties: {
              monthlyExpense: { type: 'number' },
              monthlyIncome: { type: 'number' },
              rateAnnual: { type: 'number' },
            },
            required: ['monthlyExpense'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'project_income',
          description:
            'Projeta o valor futuro de um patrimônio com aportes mensais e uma taxa anual.',
          parameters: {
            type: 'object',
            properties: {
              principal: { type: 'number' },
              monthlyContribution: { type: 'number' },
              rateAnnual: { type: 'number' },
              months: { type: 'integer' },
            },
            required: ['monthlyContribution', 'rateAnnual', 'months'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'check_rebalance',
          description:
            'Compara a alocação atual com uma meta e mostra o desvio e o valor a mover.',
          parameters: {
            type: 'object',
            properties: {
              target: {
                type: 'object',
                description: 'Percentuais por tipo (ex.: {"STOCK": 30, "FIXED_INCOME": 60})',
              },
            },
            required: ['target'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'simulate_fixed_income',
          description:
            'Simula rendimento líquido de CDB, LCI, LCA ou Tesouro, com IR e isenção.',
          parameters: {
            type: 'object',
            properties: {
              principal: { type: 'number', description: 'Valor aplicado em BRL' },
              months: { type: 'integer', description: 'Prazo em meses' },
              product: { type: 'string', enum: ['CDB', 'LCI', 'LCA', 'TESOURO'] },
              rateType: {
                type: 'string',
                enum: ['PREFIXED', 'CDI_PERCENT', 'IPCA_PLUS'],
              },
              rate: {
                type: 'number',
                description:
                  'Taxa: % a.a. se prefixado; % do CDI se CDI_PERCENT; % real se IPCA_PLUS',
              },
              cdiAnnual: { type: 'number', description: 'CDI anual em % (opcional)' },
              ipcaAnnual: { type: 'number', description: 'IPCA anual em % (opcional)' },
            },
            required: ['principal', 'months', 'product', 'rateType', 'rate'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_briefing',
          description:
            'Resumo geral para a conversa: carteira, macro, dicas recentes de IA e quantas estão não lidas. Use no início quando precisar de contexto.',
          parameters: { type: 'object', properties: {}, required: [] },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_insights',
          description:
            'Dicas recentes de IA (insights) por categoria: MACRO, RENDA_FIXA, ACOES, CRIPTO, CARTEIRA, DIARIO, GERAL.',
          parameters: {
            type: 'object',
            properties: {
              category: { type: 'string', description: 'Filtrar por categoria (opcional)' },
              limit: { type: 'integer', description: 'Quantos trazer (padrão 6, máx 10)' },
            },
            required: [],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'web_search',
          description:
            'Pesquisa rápida na internet (resumos e links). Use para contexto atual que não está na base; depois leia a fonte com fetch_page.',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Termos da pesquisa' },
            },
            required: ['query'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'fetch_page',
          description:
            'Lê o texto de uma página pública (ex.: notícia citada nas dicas). Retorna título e texto limitado.',
          parameters: {
            type: 'object',
            properties: {
              url: { type: 'string', description: 'URL http(s) pública' },
            },
            required: ['url'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'verify_tools',
          description:
            'Lista as ferramentas (skills) que você tem acesso neste perfil, com descrição. Use quando não souber o que pode fazer.',
          parameters: {
            type: 'object',
            properties: {
              profile: { type: 'string', description: 'Id do perfil (opcional, padrão: geral)' },
            },
            required: [],
          },
        },
      },
    ];
  }

  async execute(
    name: string,
    args: Record<string, unknown>,
    tenantId: string,
  ): Promise<ToolExecution> {
    try {
      switch (name) {
        case 'get_portfolio_summary':
          return await this.summary(tenantId);
        case 'get_positions':
          return await this.positions(tenantId);
        case 'get_allocation':
          return await this.allocation(tenantId);
        case 'get_macro':
          return await this.macro();
        case 'get_briefing':
          return await this.briefing(tenantId);
        case 'get_insights':
          return await this.insights(
            tenantId,
            typeof args.category === 'string' ? args.category : undefined,
            args.limit != null ? Math.max(1, Math.min(10, Number(args.limit))) : 6,
          );
        case 'web_search':
          return await this.webSearch(String(args.query || ''));
        case 'fetch_page':
          return await this.fetchPage(String(args.url || ''));
        case 'verify_tools':
          return await this.verifyTools(
            typeof args.profile === 'string' ? args.profile : undefined,
          );
        case 'search_documents':
          return await this.searchDocuments(tenantId, String(args.query || ''));
        case 'create_note':
          return await this.createNote(
            tenantId,
            String(args.title || ''),
            String(args.body || ''),
            typeof args.tags === 'string' ? args.tags : undefined,
          );
        case 'remember':
          return await this.remember(tenantId, args);
        case 'search_memory':
          return await this.searchMemory(tenantId, String(args.query || ''));
        case 'project_runway':
          return await this.runway(tenantId, args);
        case 'project_income':
          return await this.projectIncome(tenantId, args);
        case 'check_rebalance':
          return await this.rebalance(tenantId, args);
        case 'simulate_fixed_income':
          return this.simulate(args);
        default:
          return { result: { error: `Ferramenta desconhecida: ${name}` } };
      }
    } catch (error) {
      return {
        result: { error: error instanceof Error ? error.message : 'Falha na ferramenta.' },
      };
    }
  }

  private async summary(tenantId: string): Promise<ToolExecution> {
    const portfolio = await this.portfolios.getDefaultPortfolio(tenantId);
    if (!portfolio) return { result: { hasPortfolio: false } };
    const summary = await this.portfolios.summary(tenantId, portfolio.id);
    return {
      result: { ...summary, asOf: new Date().toISOString() },
      citation: {
        tool: 'get_portfolio_summary',
        source: 'Carteira do usuário',
        asOf: new Date().toISOString(),
      },
    };
  }

  private async positions(tenantId: string): Promise<ToolExecution> {
    const portfolio = await this.portfolios.getDefaultPortfolio(tenantId);
    if (!portfolio) return { result: { hasPortfolio: false } };
    const positions = await this.portfolios.positions(tenantId, portfolio.id);
    return {
      result: { positions, asOf: new Date().toISOString() },
      citation: {
        tool: 'get_positions',
        source: 'Carteira do usuário',
        asOf: new Date().toISOString(),
      },
    };
  }

  private async allocation(tenantId: string): Promise<ToolExecution> {
    const portfolio = await this.portfolios.getDefaultPortfolio(tenantId);
    if (!portfolio) return { result: { hasPortfolio: false } };
    const allocation = await this.portfolios.allocation(tenantId, portfolio.id);
    return {
      result: { ...allocation, asOf: new Date().toISOString() },
      citation: {
        tool: 'get_allocation',
        source: 'Carteira do usuário',
        asOf: new Date().toISOString(),
      },
    };
  }

  private async macro(): Promise<ToolExecution> {
    const data = (await this.macroService.getMacro()) as Record<string, unknown>;
    return {
      result: data,
      citation: {
        tool: 'get_macro',
        source: String(data.source || 'BCB'),
        asOf: String(data.fetchedAt || new Date().toISOString()),
      },
    };
  }

  private async briefing(tenantId: string): Promise<ToolExecution> {
    const asOf = new Date().toISOString();
    const [portfolio, macro, tips, unread] = await Promise.all([
      this.portfolios.aiContext(tenantId).catch(() => null),
      this.macroService.getMacro().catch(() => null),
      this.prisma.insight.findMany({
        where: { tenantId },
        orderBy: { generatedAt: 'desc' },
        take: 6,
        select: { category: true, title: true, content: true, generatedAt: true },
      }),
      this.prisma.insight.count({ where: { tenantId, isRead: false } }),
    ]);
    const result = {
      portfolio,
      macro,
      unreadInsights: unread,
      insights: tips.map((t) => ({
        category: t.category,
        title: t.title,
        content: t.content.slice(0, 500),
        generatedAt: t.generatedAt,
      })),
      asOf,
    };
    return {
      result,
      citation: { tool: 'get_briefing', source: 'Carteira + macro + dicas de IA', asOf },
    };
  }

  private async insights(
    tenantId: string,
    category: string | undefined,
    limit: number,
  ): Promise<ToolExecution> {
    const asOf = new Date().toISOString();
    const items = await this.prisma.insight.findMany({
      where: {
        tenantId,
        ...(category ? { category: category.toUpperCase() } : {}),
      },
      orderBy: { generatedAt: 'desc' },
      take: limit,
      select: { category: true, title: true, content: true, generatedAt: true },
    });
    const result = {
      insights: items.map((t) => ({
        category: t.category,
        title: t.title,
        content: t.content.slice(0, 800),
        generatedAt: t.generatedAt,
      })),
      asOf,
    };
    return {
      result,
      citation: { tool: 'get_insights', source: 'Dicas de IA', asOf },
    };
  }

  /**
   * Pesquisa rápida na internet (resumos + links, sem chave).
   * Para contexto atual; o conteúdo completo vem via fetch_page.
   */
  private async webSearch(query: string): Promise<ToolExecution> {
    const asOf = new Date().toISOString();
    const q = query.trim().slice(0, 200);
    if (!q) return { result: { error: 'Informe os termos da pesquisa.' } };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`,
        {
          signal: controller.signal,
          headers: { 'User-Agent': 'wsi-invest-ai/0.1' },
        },
      );
      if (!res.ok) return { result: { error: `Busca indisponível (HTTP ${res.status}).` } };
      const data = (await res.json()) as {
        AbstractText?: string;
        AbstractSource?: string;
        AbstractURL?: string;
        RelatedTopics?: Array<{ Text?: string; FirstURL?: string; Topics?: Array<{ Text?: string; FirstURL?: string }> }>;
      };
      const links: Array<{ text: string; url: string }> = [];
      for (const item of data.RelatedTopics || []) {
        if (item.Topics?.length) {
          for (const sub of item.Topics) {
            if (sub.Text && sub.FirstURL) links.push({ text: sub.Text.slice(0, 300), url: sub.FirstURL });
          }
        } else if (item.Text && item.FirstURL) {
          links.push({ text: item.Text.slice(0, 300), url: item.FirstURL });
        }
        if (links.length >= 6) break;
      }
      return {
        result: {
          query: q,
          summary: (data.AbstractText || '').slice(0, 1000) || null,
          source: data.AbstractSource || null,
          sourceUrl: data.AbstractURL || null,
          links: links.slice(0, 6),
          asOf,
        },
        citation: { tool: 'web_search', source: 'DuckDuckGo', asOf },
      };
    } catch (error) {
      return {
        result: { error: `Busca falhou: ${(error as Error).message}` },
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Lê o texto de uma página pública (com trava anti-SSRF e limite de tamanho).
   */
  private async fetchPage(urlArg: string): Promise<ToolExecution> {
    const asOf = new Date().toISOString();
    let url: URL;
    try {
      url = this.assertPublicUrl(urlArg);
    } catch (error) {
      return { result: { error: (error as Error).message } };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(url.toString(), {
        signal: controller.signal,
        headers: { 'User-Agent': 'wsi-invest-ai/0.1', Accept: 'text/html,text/plain' },
      });
      if (!res.ok) return { result: { error: `Página retornou HTTP ${res.status}.` } };
      this.assertPublicUrl(res.url);
      const html = await res.text();
      return {
        result: {
          url: res.url,
          title: this.htmlTitle(html),
          text: this.htmlToText(html).slice(0, 12000),
          asOf,
        },
        citation: { tool: 'fetch_page', source: new URL(res.url).hostname, asOf },
      };
    } catch (error) {
      return {
        result: { error: `Falha ao ler a página: ${(error as Error).message}` },
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Skill de autodescoberta: lista as tools liberadas para o perfil,
   * para o agente saber o que pode fazer antes de agir.
   */
  private async verifyTools(profileId?: string): Promise<ToolExecution> {
    const asOf = new Date().toISOString();
    const names = toolsForProfile(
      profileId,
      this.definitions().map((d) => d.function.name),
    );
    const byName = new Map(this.definitions().map((d) => [d.function.name, d.function.description]));
    return {
      result: {
        profile: profileId || 'geral',
        tools: names.map((name) => ({ name, description: byName.get(name) || '' })),
        asOf,
      },
      citation: { tool: 'verify_tools', source: 'Catálogo do agente', asOf },
    };
  }

  private assertPublicUrl(raw: string): URL {    let url: URL;
    try {
      url = new URL(String(raw || ''));
    } catch {
      throw new BadRequestException('URL inválida.');
    }
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new BadRequestException('Apenas URLs http/https.');
    }
    const host = url.hostname.toLowerCase();
    const blocked =
      host === 'localhost' ||
      host.endsWith('.localhost') ||
      host === '::1' ||
      host === '0.0.0.0' ||
      host === '169.254.169.254' ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host);
    if (blocked) throw new BadRequestException('URL não permitida.');
    return url;
  }

  private htmlTitle(html: string): string {
    const m = html.match(/<title[^>]*>([\s\S]{1,300})<\/title>/i);
    return (m?.[1] || '').replace(/\s+/g, ' ').trim();
  }

  private htmlToText(html: string): string {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#0?39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async searchDocuments(tenantId: string, query: string): Promise<ToolExecution> {
    const asOf = new Date().toISOString();
    const documents = await this.documents.search(tenantId, query);
    return {
      result: {
        documents: documents.map((doc) => ({
          title: doc.title,
          tags: doc.tags,
          body: doc.body.slice(0, 2000),
        })),
        asOf,
      },
      citation: {
        tool: 'search_documents',
        source: 'Notas do usuário',
        asOf,
      },
    };
  }

  private async createNote(
    tenantId: string,
    title: string,
    body: string,
    tags?: string,
  ): Promise<ToolExecution> {
    const asOf = new Date().toISOString();
    if (!title.trim() || !body.trim()) {
      return { result: { error: 'Informe título e conteúdo da anotação.' } };
    }
    const note = await this.documents.create(tenantId, {
      title: title.trim().slice(0, 140),
      body: body.trim().slice(0, 8000),
      tags: tags?.trim() || undefined,
    });
    return {
      result: { note: { id: note.id, title: note.title, tags: note.tags }, asOf },
      citation: { tool: 'create_note', source: 'Diário do usuário', asOf },
    };
  }

  private async remember(
    tenantId: string,
    args: Record<string, unknown>,
  ): Promise<ToolExecution> {
    const asOf = new Date().toISOString();
    const memory = await this.memories.create(tenantId, {
      content: String(args.content || ''),
      kind: typeof args.kind === 'string' ? args.kind : undefined,
      tags: typeof args.tags === 'string' ? args.tags : undefined,
      importance: args.importance != null ? Number(args.importance) : undefined,
    });
    return {
      result: { memory: { id: memory.id, kind: memory.kind, content: memory.content }, asOf },
      citation: { tool: 'remember', source: 'Memória do agente', asOf },
    };
  }

  private async searchMemory(
    tenantId: string,
    query: string,
  ): Promise<ToolExecution> {
    const asOf = new Date().toISOString();
    const memories = await this.memories.search(tenantId, query);
    return {
      result: {
        memories: memories.map((memory) => ({
          kind: memory.kind,
          content: memory.content,
          tags: memory.tags,
        })),
        asOf,
      },
      citation: { tool: 'search_memory', source: 'Memória do agente', asOf },
    };
  }

  private async runway(
    tenantId: string,
    args: Record<string, unknown>,
  ): Promise<ToolExecution> {
    const asOf = new Date().toISOString();
    const result = await this.analysis.runway(tenantId, {
      monthlyExpense: Number(args.monthlyExpense),
      monthlyIncome: args.monthlyIncome != null ? Number(args.monthlyIncome) : undefined,
      rateAnnual: args.rateAnnual != null ? Number(args.rateAnnual) : undefined,
    });
    return {
      result: { ...result, asOf },
      citation: { tool: 'project_runway', source: 'Carteira do usuário', asOf },
    };
  }

  private async projectIncome(
    tenantId: string,
    args: Record<string, unknown>,
  ): Promise<ToolExecution> {
    const asOf = new Date().toISOString();
    let principal = args.principal != null ? Number(args.principal) : 0;
    if (args.principal == null) {
      const portfolio = await this.portfolios.getDefaultPortfolio(tenantId);
      if (portfolio) {
        const summary = await this.portfolios.summary(tenantId, portfolio.id);
        principal = summary.totalValue;
      }
    }
    const result = this.analysis.project({
      principal,
      monthlyContribution: Number(args.monthlyContribution),
      rateAnnual: Number(args.rateAnnual),
      months: Math.max(1, Math.round(Number(args.months))),
    });
    return {
      result: { ...result, asOf },
      citation: { tool: 'project_income', source: 'Cálculo determinístico', asOf },
    };
  }

  private async rebalance(
    tenantId: string,
    args: Record<string, unknown>,
  ): Promise<ToolExecution> {
    const asOf = new Date().toISOString();
    const target = (args.target || {}) as Record<string, number>;
    const result = await this.analysis.rebalance(tenantId, { target });
    return {
      result: { ...result, asOf },
      citation: { tool: 'check_rebalance', source: 'Carteira do usuário', asOf },
    };
  }

  private simulate(args: Record<string, unknown>): ToolExecution {
    const result = this.fixedIncome.simulate({
      principal: Number(args.principal),
      months: Number(args.months),
      product: String(args.product) as never,
      rateType: String(args.rateType) as never,
      rate: Number(args.rate),
      cdiAnnual: args.cdiAnnual != null ? Number(args.cdiAnnual) : undefined,
      ipcaAnnual: args.ipcaAnnual != null ? Number(args.ipcaAnnual) : undefined,
    });
    return {
      result: { ...result, asOf: new Date().toISOString() },
      citation: {
        tool: 'simulate_fixed_income',
        source: 'Cálculo determinístico (IR/isenção)',
        asOf: new Date().toISOString(),
      },
    };
  }
}
