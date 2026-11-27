import { OpportunitiesService } from './opportunities.service';
import { buildThermometer } from './thermometer';

describe('OpportunitiesService', () => {
  const prisma = {
    opportunityBrief: { findMany: jest.fn(), create: jest.fn() },
    opportunitySnapshot: {
      findFirst: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
    },
  };
  const registry = { resolve: jest.fn() };
  const macro = { getMacro: jest.fn() };
  const news = { headlines: jest.fn() };

  let service: OpportunitiesService;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('no network')) as unknown as typeof fetch;
    macro.getMacro.mockResolvedValue({ selic: 14, ipcaMonthly: 0.5 });
    news.headlines.mockResolvedValue([]);
    prisma.opportunitySnapshot.findFirst.mockResolvedValue(null);
    prisma.opportunitySnapshot.createMany.mockResolvedValue({ count: 9 });
    prisma.opportunitySnapshot.findMany.mockResolvedValue([]);
    service = new OpportunitiesService(
      prisma as never,
      registry as never,
      macro as never,
      news as never,
      {} as never,
      {} as never,
      { promptStats: jest.fn().mockResolvedValue(null) } as never,
      { notify: jest.fn().mockResolvedValue({}) } as never,
      // whatIf: simulações falham silenciosamente (dicas voltam sem bloco de simulação)
      { strategy: jest.fn().mockRejectedValue(new Error('no network')) } as never,
    );
  });

  it('conta manchetes por tema no radar', async () => {
    news.headlines.mockResolvedValue([
      { title: 'Bitcoin dispara com fluxo de ETF', source: 'X', url: 'u1' },
      { title: 'Supermercado aumenta preços', source: 'Y', url: 'u2' },
    ]);
    prisma.opportunityBrief.findMany.mockResolvedValue([]);

    const radar = await service.radar('t1');
    const cripto = radar.find((item) => item.slug === 'cripto');

    expect(cripto?.attention).toBeGreaterThan(0);
    expect(radar.length).toBeGreaterThan(5);
  });

  it('analisa tema e persiste o brief', async () => {
    news.headlines.mockResolvedValue([{ title: 'Bitcoin sobe', source: 'X', url: 'u1' }]);
    prisma.opportunityBrief.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'b1', ...data }),
    );
    registry.resolve.mockResolvedValue({
      providerId: 'opencode',
      model: 'm',
      provider: {
        chat: jest.fn().mockResolvedValue({
          content: JSON.stringify({
            headline: 'Cripto em hype',
            stage: 'HYPE',
            summary: 'resumo',
            evidence: ['e1'],
            risks: ['r1'],
            confirmSignals: [],
            invalidateSignals: [],
            exitRules: ['regra'],
            psychology: 'psicologia',
            disclaimer: 'educacional',
          }),
        }),
      },
    });

    const brief = (await service.analyze('t1', 'cripto')) as { stage: string };
    expect(brief.stage).toBe('HYPE');
    expect(prisma.opportunityBrief.create).toHaveBeenCalled();
  });

  it('rejeita tema inexistente', async () => {
    await expect(service.analyze('t1', 'tema-que-nao-existe')).rejects.toThrow();
  });

  describe('termômetro', () => {
    it('tema quente em maturação é forte', () => {
      const t = buildThermometer({ attention: 8, trend: 4, stage: 'MATURACAO', hypeRisk: 20 });
      expect(t.score).toBeGreaterThanOrEqual(70);
      expect(t.label).toBe('Forte');
    });

    it('hype vira leitura bearish mesmo com atenção alta', () => {
      const t = buildThermometer({ attention: 9, trend: 5, stage: 'HYPE', hypeRisk: 80 });
      expect(t.reading).toBe('Bearish');
    });

    it('sem dados fica neutro no meio da escala', () => {
      const t = buildThermometer({});
      expect(t.score).toBe(50);
      expect(t.label).toBe('Neutro');
      expect(t.reading).toBe('Neutro');
    });

    it('sem análise, tendência de queda vira bearish', () => {
      const t = buildThermometer({ attention: 7, trend: -2 });
      expect(t.reading).toBe('Bearish');
    });

    it('sem análise, tendência de alta vira bullish', () => {
      const t = buildThermometer({ attention: 3, trend: 2 });
      expect(t.reading).toBe('Bullish');
    });

    it('emergente com tendência é bullish', () => {
      const t = buildThermometer({ attention: 2, trend: 3, stage: 'EMERGENTE', hypeRisk: 10 });
      expect(t.reading).toBe('Bullish');
    });
  });
});
