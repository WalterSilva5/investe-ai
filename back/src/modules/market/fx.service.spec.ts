import { FxService } from './fx.service';

const FX = {
  USDBRL: {
    code: 'USD',
    codein: 'BRL',
    name: 'Dólar/Real',
    bid: '5.40',
    ask: '5.41',
    pctChange: '1.5',
    create_date: '2026-10-31 10:00:00',
  },
  EURBRL: {
    code: 'EUR',
    codein: 'BRL',
    name: 'Euro/Real',
    bid: '6.00',
    ask: '6.01',
    pctChange: '-0.5',
    create_date: '2026-10-31 10:00:00',
  },
};

const GOLD = {
  price: 3800,
  currency: 'USD',
  name: 'Gold',
  symbol: 'XAU',
  updatedAt: '2026-10-31T10:00:00Z',
};

describe('FxService', () => {
  let service: FxService;
  const fetchMock = jest.fn();

  beforeAll(() => {
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  beforeEach(() => {
    service = new FxService();
    fetchMock.mockReset();
  });

  it('parseia câmbio do AwesomeAPI', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => FX });

    const result = await service.getFx();

    expect(result.available).toBe(true);
    expect(result.rates).toHaveLength(2);
    expect(result.rates[0].pair).toBe('USD/BRL');
    expect(result.rates[0].bid).toBe(5.4);
  });

  it('converte ouro para BRL no overview', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => FX })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => GOLD });

    const result = await service.overview();

    expect(result.gold.available).toBe(true);
    expect(result.gold.price).toBe(3800);
    // USD bid = 5.4 → 3800 × 5.4 = 20520
    expect(result.gold.brl).toBeCloseTo(20520);
  });

  it('não quebra quando as fontes falham', async () => {
    fetchMock.mockRejectedValue(new Error('network'));

    const result = await service.overview();

    expect(result.fx.available).toBe(false);
    expect(result.gold.available).toBe(false);
  });
});
