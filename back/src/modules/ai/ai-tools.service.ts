import { BadRequestException, Injectable } from '@nestjs/common';
import { FixedIncomeService } from '../fixed-income/fixed-income.service';
import { DocumentsService } from '../documents/documents.service';
import { MemoriesService } from '../memories/memories.service';
import { AnalysisService } from '../analysis/analysis.service';
import { MacroService } from '../market/macro.service';
import { PortfoliosService } from '../portfolios/portfolios.service';
import { PrismaService } from '../../prisma/prisma.service';
import { DiscoveryService } from '../discovery/discovery.service';
import { QuotesService } from '../market/quotes.service';
import { OpportunitiesService } from '../opportunities/opportunities.service';
import { PromptSimService } from '../prompts/sim/prompt-sim.service';
import { classifySymbol } from '../prompts/sim/asset-classes';
import { FinanceService } from '../finance/finance.service';
import { WhatIfService } from '../market/whatif.service';
import { alignSeries, weeklySample, correlationPairs, portfolioBacktest, round2 } from './tool-math';
import { chartBreakdown } from '../market/chart';
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
    private readonly discovery: DiscoveryService,
    private readonly quotes: QuotesService,
    private readonly opportunities: OpportunitiesService,
    private readonly promptSim: PromptSimService,
    private readonly finance: FinanceService,
    private readonly whatIf: WhatIfService,
  ) {}

  definitions(): ToolDefinition[] {
    return [
      {
        type: 'function',
        function: {
          name: 'whatif_investment',
          description:
            'Simulador de passado: "se eu tivesse investido R$ X há N anos em SYMBOL, quanto teria hoje?" — valor final, lucro, ROI, anualizada, drawdown e comparação com o CDI do mesmo período.',
          parameters: {
            type: 'object',
            properties: {
              symbol: { type: 'string', description: 'ticker (ex.: ITUB4, IVVB11, BTC)' },
              amount: { type: 'number', description: 'valor inicial em BRL' },
              months: { type: 'number', description: 'janela (padrão 12; cripto máx 12)' },
              monthly: { type: 'number', description: 'aporte mensal opcional' },
            },
            required: ['symbol', 'amount'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'whatif_strategy',
          description:
            'Simulador de passado SEGUINDO O AGENTE: análises mensais no período (mesma régua do veredito — Oportunidade compra o caixa, Evitar zera a posição) e compara com compra-e-segura e CDI. Use para "e se eu tivesse seguido o agente em ITUB4 há 2 anos?".',
          parameters: {
            type: 'object',
            properties: {
              symbol: { type: 'string' },
              amount: { type: 'number', description: 'caixa inicial em BRL' },
              months: { type: 'number', description: 'janela (padrão 24; cripto máx 12)' },
              monthly: { type: 'number', description: 'aporte mensal opcional' },
            },
            required: ['symbol', 'amount'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'whatif_portfolio',
          description:
            'Simulador de passado DIVERSIFICADO: várias pernas (símbolo + valor + aporte mensal opcional) e o resultado combinado — total investido, valor final, lucro, anualizada, drawdown e comparativo CDI. Use para "se eu tivesse investido R$ 1.000 em PETR4 e R$ 2.000 em IVVB11 há 5 anos".',
          parameters: {
            type: 'object',
            properties: {
              legs: {
                type: 'array',
                description: '1 a 8 pernas, cada uma {symbol, amount, monthly?}',
                items: {
                  type: 'object',
                  properties: {
                    symbol: { type: 'string' },
                    amount: { type: 'number' },
                    monthly: { type: 'number' },
                  },
                  required: ['symbol', 'amount'],
                },
              },
              months: { type: 'number', description: 'janela (padrão 12; cripto máx 12)' },
            },
            required: ['legs'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'compare_assets',
          description:
            'Compara 2 a 4 ativos lado a lado (tendência, score, RSI, ganho/risco, volatilidade) e diz qual o cenário mais favorável do conjunto. Use em perguntas "X ou Y?".',
          parameters: {
            type: 'object',
            properties: {
              symbols: { type: 'array', items: { type: 'string' }, description: '2 a 4 tickers' },
            },
            required: ['symbols'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'correlation',
          description:
            'Correlação entre 2 a 5 ativos (último ano, retornos semanais). Use quando o usuário perguntar sobre diversificação ou "posso somar X ao que já tenho?".',
          parameters: {
            type: 'object',
            properties: {
              symbols: { type: 'array', items: { type: 'string' }, description: '2 a 5 tickers' },
            },
            required: ['symbols'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'portfolio_backtest',
          description:
            'Retrospectiva de uma alocação proposta: retorna total, anualizada, volatilidade, drawdown máximo e melhor/pior mês no histórico (pesos fixos rebalanceados). Útil para "e se eu tivesse investido X% em A e Y% em B?".',
          parameters: {
            type: 'object',
            properties: {
              weights: {
                type: 'object',
                description: 'JSON de ticker → peso (0-1, somando ~1). Ex.: {"PETR4":0.5,"IVVB11":0.5}',
              },
              months: { type: 'number', description: 'janela em meses (padrão 12, máx 60)' },
            },
            required: ['weights'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'add_finance_entry',
          description:
            'Registra receita ou despesa no livro financeiro do usuário (pessoal ou empresa). Use quando o usuário pedir para anotar um gasto/receita — isto atualiza o excedente mensal usado nas dicas.',
          parameters: {
            type: 'object',
            properties: {
              bookKind: { type: 'string', enum: ['pessoal', 'empresa'] },
              kind: { type: 'string', enum: ['income', 'expense'] },
              amount: { type: 'number', description: 'valor positivo' },
              category: { type: 'string', description: 'ex.: salario, aluguel, fornecedores' },
              note: { type: 'string' },
            },
            required: ['bookKind', 'kind', 'amount'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'update_cash',
          description:
            'Atualiza o caixa atual e/ou a reserva de emergência de um livro financeiro (pessoal ou empresa). Use quando o usuário informar saldo novo ("tenho 20 mil na conta").',
          parameters: {
            type: 'object',
            properties: {
              bookKind: { type: 'string', enum: ['pessoal', 'empresa'] },
              cashBalance: { type: 'number' },
              emergencyReserve: { type: 'number' },
            },
            required: ['bookKind'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'analyze_chart',
          description:
            'Análise técnica COMPLETA do gráfico de um ativo: todos os suportes e resistências (com distância %), MM20/50/200 e cruzamento dourado/morte, RSI, MACD (histograma e cruzamento recente), Bollinger, estrutura de topos/fundos e posição vs 52 semanas. Use quando o usuário pedir análise de gráfico, suporte/resistência ou métricas técnicas em profundidade.',
          parameters: {
            type: 'object',
            properties: {
              symbol: { type: 'string' },
            },
            required: ['symbol'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_cash_position',
          description:
            'Caixa do usuário para investir: saldo pessoal e da empresa, reserva de emergência, disponível para investir, excedente mensal e runway. Use ANTES de sugerir aporte ou alocação.',
          parameters: { type: 'object', properties: {}, required: [] },
        },
      },
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
          name: 'analyze_theme',
          description:
            'Análise detalhada de um tema/narrativa do radar (ex.: cripto, ia, bancos, agro): estágio do ciclo, evidências, riscos e regras de saída. Use antes de sugerir oportunidades no tema.',
          parameters: {
            type: 'object',
            properties: {
              slug: {
                type: 'string',
                description: 'Slug do tema (ia, cripto, metaverso, nft, web3, semicondutores, energia, defesa, saude, agro, bancos, fiis, petroleo-mineracao, consumo-varejo)',
              },
              mode: {
                type: 'string',
                enum: ['growth', 'conservative'],
                description: 'Crescimento máximo ou conservador (padrão: growth)',
              },
            },
            required: ['slug'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_stock_outlook',
          description:
            'Leitura técnica de um ticker (qualquer bolsa/cripto): tendência, score, RSI, suportes/resistências, ganho/risco e histórico do padrão. Use antes de opinar sobre um papel.',
          parameters: {
            type: 'object',
            properties: {
              symbol: { type: 'string', description: 'Ticker (ex.: PETR4, NVDA, BTC)' },
              range: {
                type: 'string',
                description: 'Período: 3mo, 6mo, 1y (padrão) ou 2y',
              },
            },
            required: ['symbol'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'track_symbol',
          description:
            'Adiciona um ticker à watchlist de Descobertas (as telas de Tracking e Descobertas passam a mostrá-lo). Use quando identificar boas opções ou quando o usuário pedir para acompanhar um papel.',
          parameters: {
            type: 'object',
            properties: {
              symbol: { type: 'string', description: 'Ticker (ex.: PETR4, NVDA, BTC)' },
              note: {
                type: 'string',
                description: 'Motivo curto, com números do contexto (ex.: tendência de alta, RSI 52, ganho/risco 2,1:1)',
              },
            },
            required: ['symbol'],
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
        case 'get_cash_position':
          return await this.cashPosition(tenantId);
        case 'analyze_chart':
          return await this.analyzeChart(String(args.symbol || ''));
        case 'whatif_investment':
          return await this.whatIfInvestment(args);
        case 'whatif_portfolio':
          return await this.whatIfPortfolio(args);
        case 'whatif_strategy':
          return await this.whatIfStrategy(args);
        case 'compare_assets':
          return await this.compareAssets(
            Array.isArray(args.symbols) ? (args.symbols as unknown[]).map(String) : [],
          );
        case 'correlation':
          return await this.correlation(
            Array.isArray(args.symbols) ? (args.symbols as unknown[]).map(String) : [],
          );
        case 'portfolio_backtest':
          return await this.portfolioBacktest(args.weights as unknown, Number(args.months) || 12);
        case 'add_finance_entry':
          return await this.addFinanceEntry(tenantId, args);
        case 'update_cash':
          return await this.updateCash(tenantId, args);
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
        case 'track_symbol':
          return await this.trackSymbol(
            tenantId,
            String(args.symbol || ''),
            typeof args.note === 'string' ? args.note : undefined,
          );
        case 'get_stock_outlook':
          return await this.stockOutlook(
            String(args.symbol || ''),
            typeof args.range === 'string' ? args.range : undefined,
          );
        case 'analyze_theme':
          return await this.analyzeTheme(
            tenantId,
            String(args.slug || ''),
            typeof args.mode === 'string' ? args.mode : 'growth',
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
   */  private async verifyTools(profileId?: string): Promise<ToolExecution> {
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

  /** Leitura técnica do papel para o agente citar números ao opinar. */
  /** Simulador de passado SEGUINDO O AGENTE (análises mensais). */
  private async whatIfStrategy(args: Record<string, unknown>): Promise<ToolExecution> {
    const asOf = new Date().toISOString();
    const symbol = String(args.symbol || '').trim();
    const amount = Number(args.amount);
    if (!symbol || !Number.isFinite(amount) || amount <= 0) {
      return { result: { error: 'Informe symbol e amount (> 0).' } };
    }
    try {
      const result = (await this.whatIf.strategy(
        symbol,
        amount,
        Number(args.months) || 24,
        Number(args.monthly) || 0,
      )) as Record<string, unknown>;
      // Mantém o contexto compacto: sinais resumidos (sem a curva completa).
      const signals = Array.isArray(result.signals)
        ? (result.signals as Array<Record<string, unknown>>).slice(-14).map((s) => ({
            date: s.date,
            signal: s.signal,
            score: s.score,
          }))
        : [];
      return {
        result: { ...result, curve: undefined, signals, asOf },
        citation: {
          tool: 'whatif_strategy',
          source: `histórico ${result.symbol} (${result.currency}) + CDI BCB`,
          asOf,
        },
      };
    } catch (error) {
      return { result: { error: (error as Error).message.slice(0, 160) } };
    }
  }

  /** Simulador de passado DIVERSIFICADO via WhatIfService.portfolio. */
  private async whatIfPortfolio(args: Record<string, unknown>): Promise<ToolExecution> {
    const asOf = new Date().toISOString();
    const rawLegs = Array.isArray(args.legs) ? args.legs : [];
    const legs = rawLegs
      .map((leg) => {
        const entry = (leg ?? {}) as Record<string, unknown>;
        return {
          symbol: String(entry.symbol || '').trim().toUpperCase(),
          amount: Number(entry.amount) || 0,
          monthly: Number(entry.monthly) || 0,
        };
      })
      .filter((leg) => leg.symbol && leg.amount > 0);
    if (!legs.length) {
      return { result: { error: 'Informe legs: [{symbol, amount, monthly?}].' } };
    }
    try {
      const result = await this.whatIf.portfolio(legs, Number(args.months) || 12);
      return {
        result: { ...result, asOf },
        citation: {
          tool: 'whatif_portfolio',
          source: 'histórico de preços + CDI BCB',
          asOf,
        },
      };
    } catch (error) {
      return { result: { error: (error as Error).message.slice(0, 160) } };
    }
  }

  /** Simulador de passado via WhatIfService (mesmo cálculo da página). */
  private async whatIfInvestment(args: Record<string, unknown>): Promise<ToolExecution> {
    const asOf = new Date().toISOString();
    const symbol = String(args.symbol || '').trim();
    const amount = Number(args.amount);
    if (!symbol || !Number.isFinite(amount) || amount <= 0) {
      return { result: { error: 'Informe symbol e amount (> 0).' } };
    }
    try {
      const result = (await this.whatIf.run(
        symbol,
        amount,
        Number(args.months) || 12,
        Number(args.monthly) || 0,
      )) as Record<string, unknown>;
      return {
        result: {
          ...result,
          curve: undefined, // série completa é grande demais para o contexto do chat
          asOf,
        },
        citation: {
          tool: 'whatif_investment',
          source: `histórico ${result.symbol} (${result.currency}) + CDI BCB`,
          asOf,
        },
      };
    } catch (error) {
      return { result: { error: (error as Error).message.slice(0, 160) } };
    }
  }

  /** Comparação lado a lado de 2-4 ativos (mesma régua técnica). */
  private async compareAssets(symbols: string[]): Promise<ToolExecution> {
    const asOf = new Date().toISOString();
    const clean = symbols.map((s) => String(s).trim().toUpperCase()).filter(Boolean).slice(0, 4);
    if (clean.length < 2) {
      return { result: { error: 'Informe 2 a 4 tickers para comparar.' } };
    }
    const rows: Array<Record<string, unknown>> = [];
    for (const symbol of clean) {
      try {
        const o = await this.quotes.outlook(symbol, '1y');
        rows.push({
          symbol: o.symbol,
          currency: o.currency,
          current: o.current,
          trend: o.read.trend,
          score: o.read.score,
          rsi14: o.read.rsi14,
          support: o.read.stop,
          resistance: o.read.target,
          upsidePct: o.read.upsidePct,
          downsidePct: o.read.downsidePct,
          ratio: o.read.ratio,
          volatilityAnnualPct: o.read.volatility,
          verdictSignal: o.verdict?.signal ?? null,
          patternWinRate10: o.pattern?.winRate10 ?? null,
        });
      } catch (error) {
        rows.push({ symbol, error: (error as Error).message.slice(0, 120) });
      }
    }
    const valid = rows.filter((r) => !r.error) as Array<Record<string, any>>;
    let best: string | null = null;
    let worst: string | null = null;
    if (valid.length >= 2) {
      const ranked = [...valid].sort(
        (a, b) => (b.score ?? 0) + (b.ratio ?? 0) * 10 - ((a.score ?? 0) + (a.ratio ?? 0) * 10),
      );
      best = ranked[0]?.symbol ?? null;
      worst = ranked[ranked.length - 1]?.symbol ?? null;
    }
    return {
      result: {
        rows,
        bestScenario: best,
        worstScenario: worst,
        note:
          'Ranking educacional por score técnico + relação ganho/risco do conjunto — não é recomendação de compra/venda.',
        asOf,
      },
      citation: { tool: 'compare_assets', source: 'outlook técnico (mesma régua)', asOf },
    };
  }

  /** Correlação entre ativos (último ano, retornos semanais). */
  private async correlation(symbols: string[]): Promise<ToolExecution> {
    const asOf = new Date().toISOString();
    const clean = symbols.map((s) => String(s).trim().toUpperCase()).filter(Boolean).slice(0, 5);
    if (clean.length < 2) {
      return { result: { error: 'Informe 2 a 5 tickers para correlacionar.' } };
    }
    const series: Array<{ symbol: string; points: Array<{ date: string; close: number }> }> = [];
    for (const symbol of clean) {
      try {
        const { points } = await this.quotes.history(symbol, '1y');
        series.push({ symbol, points });
      } catch (error) {
        return { result: { error: `Sem histórico para ${symbol}: ${(error as Error).message.slice(0, 100)}` } };
      }
    }
    const aligned = weeklySample(alignSeries(series));
    if (aligned.dates.length < 10) {
      return { result: { error: 'Histórico alinhado insuficiente para correlação.' } };
    }
    const pairs = correlationPairs(clean, aligned);
    const classified = pairs.map((p) => ({
      ...p,
      level:
        p.r == null
          ? 'sem dados suficientes'
          : Math.abs(p.r) >= 0.7
            ? (p.r > 0 ? 'alta (mesma tese)' : 'inversa (proteção)')
            : Math.abs(p.r) >= 0.4
              ? 'moderada'
              : 'baixa (boa diversificação entre esses dois)',
    }));
    const strongest = [...classified]
      .filter((p) => p.r != null)
      .sort((a, b) => Math.abs(b.r!) - Math.abs(a.r!))[0] ?? null;
    return {
      result: {
        window: 'últimos ~12 meses, retornos semanais',
        pairs: classified,
        strongestPair: strongest,
        note:
          'Correlação alta = os dois caem juntos (uma tese com dois nomes). Baixa/negativa = diversificação real. Descreve o passado — não garante o futuro.',
        asOf,
      },
      citation: { tool: 'correlation', source: 'histórico de preços (semanal)', asOf },
    };
  }

  /** Backtest de alocação proposta com pesos fixos rebalanceados. */
  private async portfolioBacktest(weightsInput: unknown, months: number): Promise<ToolExecution> {
    const asOf = new Date().toISOString();
    if (!weightsInput || typeof weightsInput !== 'object') {
      return { result: { error: 'Informe weights como JSON de ticker → peso.' } };
    }
    const entries = Object.entries(weightsInput as Record<string, unknown>)
      .map(([symbol, weight]) => [symbol.trim().toUpperCase(), Number(weight)] as const)
      .filter(([symbol, weight]) => symbol && Number.isFinite(weight) && weight > 0)
      .slice(0, 8);
    if (entries.length < 1) {
      return { result: { error: 'Nenhum peso válido informado.' } };
    }
    const weightSum = entries.reduce((acc, [, w]) => acc + w, 0);
    const weights = entries.map(([, w]) => w / weightSum);
    const monthsClamped = Math.max(3, Math.min(60, months || 12));
    const range = monthsClamped <= 12 ? '1y' : monthsClamped <= 24 ? '2y' : '5y';
    const series: Array<{ symbol: string; points: Array<{ date: string; close: number }> }> = [];
    for (const [symbol] of entries) {
      try {
        const { points } = await this.quotes.history(symbol, range);
        series.push({ symbol, points });
      } catch (error) {
        return { result: { error: `Sem histórico para ${symbol}: ${(error as Error).message.slice(0, 100)}` } };
      }
    }
    const aligned = alignSeries(series);
    const metrics = portfolioBacktest(weights, aligned);
    if (!metrics) {
      return { result: { error: 'Histórico insuficiente ou pesos inválidos para o backtest.' } };
    }
    // Retorno individual de cada componente no mesmo período (para contexto).
    const individual = entries.map(([symbol], i) => {
      const col = aligned.closes.map((row) => row[i]);
      const first = col[0];
      const last = col[col.length - 1];
      return { symbol, totalReturnPct: round2((last / first - 1) * 100), weightPct: round2(weights[i] * 100) };
    });
    return {
      result: {
        weights: Object.fromEntries(entries.map(([s], i) => [s, round2(weights[i] * 100)])),
        window: `${aligned.dates[0]} → ${aligned.dates[aligned.dates.length - 1]} (${aligned.dates.length} pregões, pesos fixos)`,
        metrics,
        individual,
        note:
          'Retrospectiva do padrão no passado — não prevê o futuro e não garante retorno similar. Pesos fixos rebalanceados a cada pregão.',
        asOf,
      },
      citation: { tool: 'portfolio_backtest', source: 'histórico de preços', asOf },
    };
  }

  /** O agente registra receita/despesa no livro financeiro. */
  private async addFinanceEntry(
    tenantId: string,
    args: Record<string, unknown>,
  ): Promise<ToolExecution> {
    const bookKind = String(args.bookKind || '').toLowerCase();
    const kind = String(args.kind || '').toLowerCase();
    const amount = Number(args.amount);
    if (!['pessoal', 'empresa'].includes(bookKind)) {
      return { result: { error: 'bookKind deve ser "pessoal" ou "empresa".' } };
    }
    if (!['income', 'expense'].includes(kind)) {
      return { result: { error: 'kind deve ser "income" ou "expense".' } };
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return { result: { error: 'amount precisa ser um valor positivo.' } };
    }
    const book = await this.prisma.financeBook.findFirst({ where: { tenantId, kind: bookKind } });
    if (!book) return { result: { error: 'Livro financeiro não encontrado.' } };
    const entry = await this.finance.addEntry(tenantId, book.id, {
      kind,
      amount,
      category: typeof args.category === 'string' ? args.category : undefined,
      note: typeof args.note === 'string' ? args.note : 'registrado pelo agente',
    });
    const asOf = new Date().toISOString();
    return {
      result: {
        registered: true,
        entryId: entry.id,
        book: bookKind,
        kind,
        amount,
        hint: 'Atualize o caixa com update_cash se o saldo da conta mudou.',
        asOf,
      },
      citation: { tool: 'add_finance_entry', source: 'Livros de finanças', asOf },
    };
  }

  /** O agente atualiza caixa/reserva do livro financeiro. */
  private async updateCash(tenantId: string, args: Record<string, unknown>): Promise<ToolExecution> {
    const bookKind = String(args.bookKind || '').toLowerCase();
    if (!['pessoal', 'empresa'].includes(bookKind)) {
      return { result: { error: 'bookKind deve ser "pessoal" ou "empresa".' } };
    }
    const book = await this.prisma.financeBook.findFirst({ where: { tenantId, kind: bookKind } });
    if (!book) return { result: { error: 'Livro financeiro não encontrado.' } };
    const cashBalance = args.cashBalance != null ? Number(args.cashBalance) : undefined;
    const emergencyReserve = args.emergencyReserve != null ? Number(args.emergencyReserve) : undefined;
    if ((cashBalance != null && !Number.isFinite(cashBalance)) || (emergencyReserve != null && !Number.isFinite(emergencyReserve))) {
      return { result: { error: 'Valores precisam ser numéricos.' } };
    }
    await this.finance.updateBook(tenantId, book.id, { cashBalance, emergencyReserve });
    const summary = await this.finance.summary(tenantId);
    const asOf = new Date().toISOString();
    return {
      result: {
        updated: true,
        book: bookKind,
        cashBalance: cashBalance ?? null,
        emergencyReserve: emergencyReserve ?? null,
        investableNow: round(summary.investable),
        asOf,
      },
      citation: { tool: 'update_cash', source: 'Livros de finanças', asOf },
    };
  }

  /** Análise técnica completa do gráfico (mesma matemática da página, todos os níveis). */
  private async analyzeChart(symbol: string): Promise<ToolExecution> {
    const asOf = new Date().toISOString();
    const clean = symbol.trim().toUpperCase();
    if (!clean) return { result: { error: 'Informe o ticker.' } };
    try {
      const { symbol: resolved, currency, points } = await this.quotes.history(clean, '2y');
      const closes = points.map((p) => p.close);
      const breakdown = chartBreakdown(closes);
      if (!breakdown) {
        return { result: { error: `Histórico insuficiente para ${resolved}.` } };
      }
      // Réguas de contexto para o agente interpretar.
      const context = {
        price: breakdown.price,
        currency,
        movingAverages: {
          ma20: breakdown.ma20,
          ma50: breakdown.ma50,
          ma200: breakdown.ma200,
          goldenDeathCross: breakdown.goldenDeath,
        },
        rsi14: breakdown.rsi14,
        macd: breakdown.macd,
        bollinger: breakdown.bollinger,
        levels: {
          supportsAbovePrice: breakdown.supportsAbove.slice(0, 4),
          supportsBelowPrice: breakdown.supportsBelow.slice(0, 4),
          resistancesAbovePrice: breakdown.resistancesAbove.slice(0, 4),
          resistancesBelowPrice: breakdown.resistancesBelow.slice(0, 4),
          note: 'níveis da janela de 12 meses (mínimos/máximos locais agrupados ±1,5%)',
        },
        weeks52: {
          high: breakdown.high52w,
          low: breakdown.low52w,
          fromHighPct: breakdown.fromHigh52wPct,
          fromLowPct: breakdown.fromLow52wPct,
        },
        marketStructure: breakdown.structure,
        asOf,
      };
      return {
        result: context,
        citation: {
          tool: 'analyze_chart',
          source: `histórico ${resolved} (${currency}) — métricas técnicas`,
          asOf,
        },
      };
    } catch (error) {
      return { result: { error: (error as Error).message.slice(0, 160) } };
    }
  }

  /** Caixa disponível para investir (pessoal + empresa) — base para qualquer dica de aporte. */
  private async cashPosition(tenantId: string): Promise<ToolExecution> {
    const asOf = new Date().toISOString();
    const summary = await this.finance.summary(tenantId);
    return {
      result: {
        hasFinance: summary.hasData,
        cashTotal: round(summary.cashTotal),
        reserved: round(summary.reserved),
        investable: round(summary.investable),
        monthlySurplus: round(summary.monthlySurplus),
        books: summary.books.map((b) => ({
          kind: b.kind,
          label: b.label,
          caixa: round(b.cashBalance),
          reserva: round(b.emergencyReserve),
          disponivelParaInvestir: round(b.investable),
          receitaMensal: round(b.monthlyIncome),
          despesaMensal: round(b.monthlyExpense),
          excedenteMensal: round(b.monthlySurplus),
          runwayMeses: b.runwayMonths,
        })),
        asOf,
      },
      citation: { tool: 'get_cash_position', source: 'Livros de finanças do usuário', asOf },
    };
  }

  private async stockOutlook(symbol: string, range?: string): Promise<ToolExecution> {
    const asOf = new Date().toISOString();
    const clean = symbol.trim().toUpperCase();
    if (!clean) return { result: { error: 'Informe o ticker.' } };
    // Equivalentes usuais (BDR ↔ ação nos EUA) para não travar no primeiro erro.
    const aliases: Record<string, string[]> = {
      NU: ['ROXO34'],
      ROXO34: ['NU'],
      AAPL: ['AAPL34'],
      MSFT: ['MSFT34'],
      GOOGL: ['GOGL34'],
      AMZN: ['AMZO34'],
      META: ['M1TA34'],
      TSLA: ['TSLA34'],
      NVDA: ['NVDC34'],
      JPM: ['JPMC34'],
      XOM: ['EXXO34'],
      PBR: ['PETR4'],
      PETR4: ['PBR'],
    };
    const candidates = [clean, ...(aliases[clean] || [])];
    const attempts: string[] = [];
    for (const candidate of candidates) {
      try {
        const outlook = await this.quotes.outlook(candidate, range || '1y');
        return {
          result: {
            symbol: outlook.symbol,
            requested: clean,
            currency: outlook.currency,
            current: outlook.current,
            trend: outlook.read.trend,
            score: outlook.read.score,
            label: outlook.read.label,
            rsi14: outlook.read.rsi14,
            volatilityAnnualPct: outlook.read.volatility,
            target: outlook.read.target,
            stop: outlook.read.stop,
            upsidePct: outlook.read.upsidePct,
            downsidePct: outlook.read.downsidePct,
            ratio: outlook.read.ratio,
            pattern: outlook.pattern,
            verdict: outlook.verdict,
            halving: outlook.halving,
            bullets: outlook.bullets,
            // Classe do ativo + framing vencedor do backtest de prompts (se houver).
            assetClass: await this.classFraming(outlook.symbol),
            asOf,
          },
          citation: { tool: 'get_stock_outlook', source: outlook.source, asOf },
        };
      } catch {
        attempts.push(candidate);
      }
    }
    return {
      result: {
        error: `Sem dados para ${clean}. Tentei: ${attempts.join(', ')}.`,
        attempts,
      },
    };
  }

  /** Classe do ativo + instrução vencedora do backtest (quando o run já existe). */
  private async classFraming(symbol: string): Promise<{
    id: string;
    label: string;
    promptNote: string | null;
  }> {
    const cls = classifySymbol(symbol);
    let promptNote: string | null = null;
    try {
      promptNote = await this.promptSim.winningInstruction(cls.id);
    } catch {
      promptNote = null;
    }
    return { id: cls.id, label: cls.label, promptNote };
  }

  /** Análise do tema via OpportunitiesService (mesmo pipeline do botão do radar). */
  private async analyzeTheme(tenantId: string, slug: string, mode: string): Promise<ToolExecution> {
    const asOf = new Date().toISOString();
    const clean = slug.trim().toLowerCase();
    if (!clean) return { result: { error: 'Informe o slug do tema.' } };
    try {
      const brief = (await this.opportunities.analyze(tenantId, clean, mode)) as Record<
        string,
        unknown
      >;
      const content = (brief.content || {}) as Record<string, unknown>;
      const trim = (value: unknown, max: number) =>
        typeof value === 'string' ? value.slice(0, max) : value;
      return {
        result: {
          theme: brief.theme,
          title: brief.title,
          stage: brief.stage,
          attention: brief.attention,
          hypeRisk: brief.hypeRisk,
          summary: trim(content['summary'], 900),
          asymmetry: trim(content['asymmetry'], 400),
          evidence: (content['evidence'] as string[])?.slice(0, 6),
          risks: (content['risks'] as string[])?.slice(0, 6),
          confirmSignals: (content['confirmSignals'] as string[])?.slice(0, 5),
          invalidateSignals: (content['invalidateSignals'] as string[])?.slice(0, 5),
          exitRules: (content['exitRules'] as string[])?.slice(0, 5),
          timing: trim(content['timing'], 300),
          psychology: trim(content['psychology'], 400),
          sources: ((brief.sources as Array<{ title?: string; url?: string }>) || [])
            .slice(0, 6)
            .map((source) => source.title || source.url),
          asOf,
        },
        citation: { tool: 'analyze_theme', source: `Radar — tema ${brief.theme}`, asOf },
      };
    } catch (error) {
      return { result: { error: (error as Error).message } };
    }
  }

  /** Registra o papel na watchlist de Descobertas e devolve o estado atual. */
  private async trackSymbol(
    tenantId: string,
    symbol: string,
    note?: string,
  ): Promise<ToolExecution> {
    const asOf = new Date().toISOString();
    const clean = symbol.trim().toUpperCase();
    if (!clean) return { result: { error: 'Informe o ticker.' } };
    const entry = await this.discovery.track(tenantId, clean, 'chat');
    const existing = entry.note || '';
    let incoming = (note || '').trim().slice(0, 240);

    // Nota sem número não ajuda: completa com a leitura técnica real do papel.
    if (!incoming || !/[0-9]/.test(incoming)) {
      try {
        const outlook = await this.quotes.outlook(clean, '1y');
        const bits = [`tendência ${outlook.read.trend}`, `RSI ${outlook.read.rsi14 ?? '—'}`];
        if (outlook.read.ratio != null) bits.push(`ganho/risco ${outlook.read.ratio.toFixed(2)}:1`);
        bits.push(`técnica ${outlook.read.score}/100`);
        incoming = bits.join(' · ');
      } catch {
        // sem histórico agora: mantém o que veio
      }
    }

    // Nota genérica não apaga uma nota concreta já registrada (com números).
    const shouldReplace =
      incoming.length > 0 && (!existing || /[0-9]/.test(incoming) || !/[0-9]/.test(existing));
    if (shouldReplace) {
      await this.prisma.trackedSymbol.update({
        where: { id: entry.id },
        data: { note: incoming },
      });
    }
    return {
      result: {
        tracked: {
          symbol: entry.symbol,
          source: entry.source,
          note: shouldReplace ? incoming : existing,
        },
        noteKept: !shouldReplace && Boolean(existing),
        asOf,
      },
      citation: { tool: 'track_symbol', source: 'Watchlist de Descobertas', asOf },
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

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
