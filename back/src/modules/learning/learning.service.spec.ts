import { LearningService } from './learning.service';

describe('LearningService', () => {
  const prisma = {
    signalLog: {
      findMany: jest.fn(),
      count: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
  };
  const quotes = {
    outlook: jest.fn(),
    history: jest.fn(),
  };

  let service: LearningService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new LearningService(prisma as never, quotes as never);
  });

  it('calibração não ajusta com amostra pequena (evita overfit)', async () => {
    prisma.signalLog.findMany.mockResolvedValue([
      { outcome: 'hit' },
      { outcome: 'hit' },
      { outcome: 'miss' },
    ]);
    const result = await service.calibration('t1', 'trend-up');
    expect(result.committed).toBe(3);
    expect(result.hitRate).toBeCloseTo(66.67, 1);
    expect(result.adjustment).toBe(0);
    expect(result.learned).toBe(false);
  });

  it('calibração positiva quando a regra acerta mais que 50% com amostra suficiente', async () => {
    prisma.signalLog.findMany.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => ({ outcome: i < 8 ? 'hit' : 'miss' })),
    );
    const result = await service.calibration('t1', 'trend-up');
    expect(result.committed).toBe(10);
    expect(result.hitRate).toBe(80);
    // Laplace: (8+1)/(10+2) = 0.75 → (0.75-0.5)*20 = 5
    expect(result.adjustment).toBe(5);
    expect(result.learned).toBe(true);
  });

  it('regra perdedora reduz o score', async () => {
    prisma.signalLog.findMany.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => ({ outcome: i < 2 ? 'hit' : 'miss' })),
    );
    const result = await service.calibration('t1', 'trend-down');
    expect(result.adjustment).toBeLessThan(0);
  });

  it('outlook aplica calibração no score e registra o sinal do dia', async () => {
    quotes.outlook.mockResolvedValue({
      symbol: 'PETR4',
      current: 40,
      read: { score: 50, label: 'Neutro', trend: 'alta', rsi14: 55, target: 44, stop: 38 },
    });
    prisma.signalLog.findMany.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => ({ outcome: i < 9 ? 'hit' : 'miss' })),
    );
    prisma.signalLog.upsert.mockResolvedValue({});

    const result = await service.outlook('t1', 'PETR4');
    expect(result.read.rawScore).toBe(50);
    expect(result.read.score).toBeGreaterThan(50);
    expect(result.calibration.rule).toBe('trend-up');
    expect(prisma.signalLog.upsert).toHaveBeenCalledTimes(1);
    const call = prisma.signalLog.upsert.mock.calls[0][0];
    expect(call.create.direction).toBe('up');
    expect(call.create.price).toBe(40);
  });

  it('avalia sinal pendente usando o fechamento 14 dias depois', async () => {
    const day = new Date(Date.now() - 20 * 86_400_000).toISOString().slice(0, 10);
    const target = new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10);
    prisma.signalLog.findMany.mockResolvedValue([
      { id: 's1', symbol: 'PETR4', rule: 'trend-up', direction: 'up', price: 40, day },
    ]);
    quotes.history.mockResolvedValue({
      points: [
        { date: day, close: 40 },
        { date: target, close: 44 },
      ],
    });
    prisma.signalLog.update.mockResolvedValue({});

    const result = await service.evaluatePending('t1');
    expect(result.evaluated).toBe(1);
    const update = prisma.signalLog.update.mock.calls[0][0];
    expect(update.data.outcome).toBe('hit');
    expect(update.data.returnPct).toBeCloseTo(10, 1);
  });

  it('sinal de baixa acerta quando o preço cai', async () => {
    const day = new Date(Date.now() - 20 * 86_400_000).toISOString().slice(0, 10);
    const target = new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10);
    prisma.signalLog.findMany.mockResolvedValue([
      { id: 's2', symbol: 'VALE3', rule: 'trend-down', direction: 'down', price: 50, day },
    ]);
    quotes.history.mockResolvedValue({
      points: [
        { date: day, close: 50 },
        { date: target, close: 45 },
      ],
    });
    prisma.signalLog.update.mockResolvedValue({});

    await service.evaluatePending('t1');
    expect(prisma.signalLog.update.mock.calls[0][0].data.outcome).toBe('hit');
  });
});
