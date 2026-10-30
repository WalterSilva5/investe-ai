import { Injectable } from '@nestjs/common';
import { FixedIncomeService } from '../fixed-income/fixed-income.service';
import { DocumentsService } from '../documents/documents.service';
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
