import { PaperService } from './paper.service';

describe('PaperService', () => {
  const prisma = {
    actionDigest: { findFirst: jest.fn() },
    orderProposal: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
  const quotes = { getQuote: jest.fn() };
  const macro = { getMacro: jest.fn() };

  let service: PaperService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PaperService(prisma as never, quotes as never, macro as never);
  });

  it('gera proposta BUY para dica "Oportunidade" com ticker e executa no paper na cotação atual', async () => {
    prisma.actionDigest.findFirst.mockResolvedValue({
      title: 'Dicas de ação',
      generatedAt: new Date(),
      actions: [
        {
          ticker: 'PETR4',
          verdict: 'Oportunidade',
          action: 'Consolidar posição',
          why: 'Tendência de alta',
          highlight: true,
        },
      ],
    });
    prisma.orderProposal.findMany.mockResolvedValue([]); // nada hoje ainda
    quotes.getQuote.mockResolvedValue({ symbol: 'PETR4', price: 40, source: 'brapi.dev' });
    prisma.orderProposal.create.mockResolvedValue({});

    const result = await service.generateFromDigest('t1');
    expect(result.created).toBe(1);
    const create = prisma.orderProposal.create.mock.calls[0][0];
    expect(create.data.side).toBe('BUY');
    expect(create.data.symbol).toBe('PETR4');
    expect(create.data.status).toBe('paper');
    expect(create.data.paperPrice).toBe(40);
    expect(create.data.executedAt).toBeTruthy();
    expect(create.data.score).toBe(80); // destaque do dia
  });

  it('sugestão de reduzir vira SELL e tema sem ticker é ignorado', async () => {
    prisma.actionDigest.findFirst.mockResolvedValue({
      title: 'Dicas de ação',
      generatedAt: new Date(),
      actions: [
        { ticker: 'VALE3', verdict: 'Oportunidade', action: 'Reduzir exposição e realizar lucro' },
        { theme: 'IA', verdict: 'Oportunidade', action: 'Entrar no tema' },
      ],
    });
    prisma.orderProposal.findMany.mockResolvedValue([]);
    quotes.getQuote.mockResolvedValue({ symbol: 'VALE3', price: 60 });
    prisma.orderProposal.create.mockResolvedValue({});

    const result = await service.generateFromDigest('t1');
    expect(result.created).toBe(1);
    expect(result.skipped).toBe(1);
    const create = prisma.orderProposal.create.mock.calls[0][0];
    expect(create.data.side).toBe('SELL');
    expect(create.data.symbol).toBe('VALE3');
  });

  it('não duplica proposta para o mesmo símbolo no mesmo dia', async () => {
    prisma.actionDigest.findFirst.mockResolvedValue({
      title: 'Dicas',
      generatedAt: new Date(),
      actions: [{ ticker: 'ITUB4', verdict: 'Oportunidade', action: 'Entrada' }],
    });
    prisma.orderProposal.findMany.mockResolvedValue([{ symbol: 'ITUB4' }]);

    const result = await service.generateFromDigest('t1');
    expect(result.created).toBe(0);
    expect(prisma.orderProposal.create).not.toHaveBeenCalled();
  });

  it('portfolio agrega posição líquida, P&L e compara com CDI pro-rata', async () => {
    prisma.orderProposal.findMany.mockResolvedValue([
      {
        id: 'p1', symbol: 'PETR4', side: 'BUY', quantity: 100, price: 40, paperPrice: 40,
        status: 'paper', executedAt: new Date(Date.now() - 30 * 86_400_000),
      },
      {
        id: 'p2', symbol: 'PETR4', side: 'SELL', quantity: 50, price: 44, paperPrice: 44,
        status: 'paper', executedAt: new Date(Date.now() - 10 * 86_400_000),
      },
    ]);
    quotes.getQuote.mockResolvedValue({ symbol: 'PETR4', price: 50 });
    macro.getMacro.mockResolvedValue({ available: true, cdiAnnual: 10 });

    const result = await service.portfolio('t1');
    expect(result.positions).toHaveLength(1);
    const pos = result.positions[0];
    expect(pos.netQty).toBe(50); // 100 compradas, 50 vendidas
    // custo: 100*40=4000; receita da venda: 50*44=2200 → investido 1800
    expect(pos.invested).toBeCloseTo(1800, 2);
    expect(pos.currentValue).toBe(2500); // 50 * 50
    expect(pos.pnl).toBeCloseTo(700, 2);
    expect(result.totals.returnPct).toBeGreaterThan(0);
    expect(result.cdi.returnPct).toBeGreaterThan(0);
    expect(result.cdi.returnPct).toBeLessThan(1); // 10% a.a. em ~30 dias fica abaixo de 1%
  });

  it('reject marca a proposta como rejected e só afeta propostas em paper', async () => {
    prisma.orderProposal.findUnique
      .mockResolvedValueOnce({ id: 'p1', status: 'paper' })
      .mockResolvedValueOnce({ id: 'p2', status: 'rejected' });
    prisma.orderProposal.update.mockResolvedValue({});

    await service.reject('p1');
    expect(prisma.orderProposal.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { status: 'rejected' },
    });
    await expect(service.reject('p2')).rejects.toThrow();
    expect(prisma.orderProposal.update).toHaveBeenCalledTimes(1);
  });
});
