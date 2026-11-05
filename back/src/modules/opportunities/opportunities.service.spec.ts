import { OpportunitiesService } from './opportunities.service';

describe('OpportunitiesService', () => {
  const prisma = {
    opportunityBrief: { findMany: jest.fn(), create: jest.fn() },
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
    service = new OpportunitiesService(
      prisma as never,
      registry as never,
      macro as never,
      news as never,
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
});
