import { Injectable } from '@nestjs/common';
import { FixedIncomeService } from '../fixed-income/fixed-income.service';
import { DocumentsService } from '../documents/documents.service';
import { MemoriesService } from '../memories/memories.service';
import { AnalysisService } from '../analysis/analysis.service';
import { MacroService } from '../market/macro.service';
import { PortfoliosService } from '../portfolios/portfolios.service';
import { ToolDefinition } from '../ai-provider/openai-compatible.provider';

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
        case 'search_documents':
          return await this.searchDocuments(tenantId, String(args.query || ''));
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
