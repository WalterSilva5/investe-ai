import { Injectable, Logger } from '@nestjs/common';

export interface NewsItem {
  title: string;
  url: string;
  source: string;
  publishedAt?: string;
}

const DEFAULT_FEEDS: Array<{ source: string; url: string }> = [
  { source: 'InfoMoney', url: 'https://www.infomoney.com.br/feed/' },
  { source: 'Exame', url: 'https://exame.com/feed/' },
  { source: 'Agência Brasil', url: 'https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml' },
  { source: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/' },
  { source: 'The Block', url: 'https://www.theblock.co/rss.xml' },
];

/** Busca manchetes de notícias via RSS (sem chave de API). */
@Injectable()
export class NewsService {
  private readonly logger = new Logger(NewsService.name);

  async headlines(limit = 12): Promise<NewsItem[]> {
    const feeds = this.feeds();
    const perFeed = Math.max(1, Math.ceil(limit / feeds.length));

    const results = await Promise.allSettled(
      feeds.map((feed) => this.fetchFeed(feed, perFeed)),
    );

    const items: NewsItem[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled') items.push(...result.value);
    }
    return items.slice(0, limit);
  }

  private feeds(): Array<{ source: string; url: string }> {
    const env = process.env.INSIGHT_NEWS_FEEDS;
    if (!env) return DEFAULT_FEEDS;
    return env
      .split(',')
      .map((raw) => raw.trim())
      .filter((url) => url.startsWith('http'))
      .map((url) => ({ source: this.hostOf(url), url }));
  }

  private hostOf(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }

  private async fetchFeed(
    feed: { source: string; url: string },
    count: number,
  ): Promise<NewsItem[]> {
    try {
      const response = await fetch(feed.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (wsi-invest-ai/0.1)',
          Accept: 'application/rss+xml, application/xml, text/xml, */*',
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const xml = await response.text();
      return this.parseRss(xml)
        .slice(0, count)
        .map((item) => ({ ...item, source: feed.source }));
    } catch (error) {
      this.logger.warn(`Feed ${feed.source} falhou: ${(error as Error).message}`);
      return [];
    }
  }

  private parseRss(xml: string): Array<{ title: string; url: string; publishedAt?: string }> {
    const items: Array<{ title: string; url: string; publishedAt?: string }> = [];
    const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    let match: RegExpExecArray | null;
    while ((match = itemRe.exec(xml)) !== null) {
      const block = match[1];
      const title = this.tag(block, 'title');
      const url = this.tag(block, 'link') || this.tag(block, 'guid');
      if (!title) continue;
      items.push({
        title,
        url,
        publishedAt: this.tag(block, 'pubDate') || undefined,
      });
      if (items.length >= 30) break;
    }
    return items;
  }

  private tag(block: string, name: string): string {
    const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'));
    if (!m) return '';
    return this.decode(m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim());
  }

  private decode(value: string): string {
    return value
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&nbsp;/g, ' ');
  }
}
