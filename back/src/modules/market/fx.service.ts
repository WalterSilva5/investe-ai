import { Injectable, Logger } from '@nestjs/common';

export interface FxQuote {
  pair: string;
  code: string;
  codein: string;
  name: string;
  bid: number;
  ask: number;
  pctChange: number;
  timestamp: string;
  source: string;
}

const FX_URL = 'https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL,GBP-BRL';
const GOLD_URL = 'https://api.gold-api.com/price/XAU';
const CACHE_TTL_MS = 30 * 60 * 1000;

/** Câmbio (AwesomeAPI) + ouro (gold-api) — fontes gratuitas, sem chave. */
@Injectable()
export class FxService {
  private readonly logger = new Logger(FxService.name);
  private fxCache: { data: FxQuote[]; at: number } | null = null;
  private goldCache: { data: unknown; at: number } | null = null;

  async getFx(): Promise<{
    available: boolean;
    rates: FxQuote[];
    fetchedAt: string;
    source: string;
  }> {
    if (this.fxCache && Date.now() - this.fxCache.at < CACHE_TTL_MS) {
      return { available: true, rates: this.fxCache.data, fetchedAt: new Date().toISOString(), source: 'AwesomeAPI' };
    }

    try {
      const response = await fetch(FX_URL, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const raw = (await response.json()) as Record<string, Record<string, string>>;

      const rates: FxQuote[] = Object.values(raw).map((item) => ({
        pair: `${item.code}/${item.codein}`,
        code: item.code,
        codein: item.codein,
        name: item.name,
        bid: Number(item.bid),
        ask: Number(item.ask),
        pctChange: Number(item.pctChange),
        timestamp: item.create_date,
        source: 'AwesomeAPI',
      }));

      this.fxCache = { data: rates, at: Date.now() };
      return { available: true, rates, fetchedAt: new Date().toISOString(), source: 'AwesomeAPI' };
    } catch (error) {
      this.logger.warn(`Falha ao buscar câmbio: ${(error as Error).message}`);
      return { available: false, rates: [], fetchedAt: new Date().toISOString(), source: 'AwesomeAPI' };
    }
  }

  async getGold(): Promise<{
    available: boolean;
    price?: number;
    currency?: string;
    name?: string;
    symbol?: string;
    updatedAt?: string;
    fetchedAt: string;
    source: string;
  }> {
    if (this.goldCache && Date.now() - this.goldCache.at < CACHE_TTL_MS) {
      return { available: true, ...(this.goldCache.data as object), fetchedAt: new Date().toISOString(), source: 'gold-api.com' };
    }

    try {
      const response = await fetch(GOLD_URL, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const raw = (await response.json()) as {
        price: number;
        currency: string;
        name: string;
        symbol: string;
        updatedAt: string;
      };
      const data = {
        price: raw.price,
        currency: raw.currency,
        name: raw.name,
        symbol: raw.symbol,
        updatedAt: raw.updatedAt,
      };
      this.goldCache = { data, at: Date.now() };
      return { available: true, ...data, fetchedAt: new Date().toISOString(), source: 'gold-api.com' };
    } catch (error) {
      this.logger.warn(`Falha ao buscar ouro: ${(error as Error).message}`);
      return { available: false, fetchedAt: new Date().toISOString(), source: 'gold-api.com' };
    }
  }

  /** Câmbio + ouro, com o ouro convertido para BRL. */
  async overview() {
    const [fx, gold] = await Promise.all([this.getFx(), this.getGold()]);
    const usdBid = fx.rates.find((rate) => rate.code === 'USD')?.bid;
    const goldBrl = gold.available && gold.price && usdBid ? gold.price * usdBid : undefined;
    return {
      fx,
      gold: { ...gold, brl: goldBrl },
    };
  }
}
