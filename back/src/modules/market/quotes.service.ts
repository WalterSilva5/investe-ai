import { Injectable, Logger } from '@nestjs/common';
import { AssetType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PortfoliosService } from '../portfolios/portfolios.service';

export interface Quote {
  symbol: string;
  price: number;
  currency: string;
  source: string;
  fetchedAt: string;
}

const CRYPTO_IDS: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  ADA: 'cardano',
  XRP: 'ripple',
  DOGE: 'dogecoin',
  BNB: 'binancecoin',
  USDT: 'tether',
  USDC: 'usd-coin',
};

@Injectable()
export class QuotesService {
  private readonly logger = new Logger(QuotesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly portfolios: PortfoliosService,
  ) {}

  async getQuote(symbol: string, type: AssetType = AssetType.STOCK): Promise<Quote> {
    if (type === AssetType.CRYPTO) {
      return this.cryptoQuote(symbol);
    }
    return this.b3Quote(symbol);
  }

  async refreshPortfolioPrices(tenantId: string) {
    const portfolio = await this.portfolios.getDefaultPortfolio(tenantId);
    if (!portfolio) return { total: 0, updated: 0, failed: 0, quotes: [] };

    const positions = await this.prisma.position.findMany({
      where: { portfolioId: portfolio.id },
      include: { asset: true },
    });

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const quotes: Quote[] = [];
    const failures: Array<{ symbol: string; error: string }> = [];

    for (const position of positions) {
      try {
        const quote = await this.getQuote(position.asset.symbol, position.asset.type);
        await this.prisma.price.upsert({
          where: { assetId_date: { assetId: position.assetId, date: today } },
          create: {
            assetId: position.assetId,
            date: today,
            close: quote.price,
            source: quote.source,
          },
          update: { close: quote.price, source: quote.source, fetchedAt: new Date() },
        });
        quotes.push(quote);
      } catch (error) {
        failures.push({
          symbol: position.asset.symbol,
          error: error instanceof Error ? error.message : 'falha',
        });
      }
    }

    return {
      total: positions.length,
      updated: quotes.length,
      failed: failures.length,
      quotes,
      failures,
    };
  }

  private async b3Quote(symbol: string): Promise<Quote> {
    const token = process.env.BRAPI_TOKEN;
    const url = `https://brapi.dev/api/quote/${encodeURIComponent(symbol)}${token ? `?token=${token}` : ''}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`brapi ${symbol}: HTTP ${response.status}`);
    }
    const data = (await response.json()) as {
      results?: Array<{ regularMarketPrice?: number; currency?: string }>;
    };
    const result = data.results?.[0];
    if (!result?.regularMarketPrice) {
      throw new Error(`brapi ${symbol}: sem preço`);
    }
    return {
      symbol,
      price: result.regularMarketPrice,
      currency: result.currency || 'BRL',
      source: 'brapi.dev',
      fetchedAt: new Date().toISOString(),
    };
  }

  private async cryptoQuote(symbol: string): Promise<Quote> {
    const id = CRYPTO_IDS[symbol.toUpperCase()] || symbol.toLowerCase();
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=brl`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`CoinGecko ${symbol}: HTTP ${response.status}`);
    }
    const data = (await response.json()) as Record<string, { brl?: number }>;
    const price = data[id]?.brl;
    if (!price) {
      throw new Error(`CoinGecko ${symbol}: sem preço`);
    }
    return {
      symbol,
      price,
      currency: 'BRL',
      source: 'CoinGecko',
      fetchedAt: new Date().toISOString(),
    };
  }
}
