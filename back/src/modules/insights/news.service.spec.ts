import { NewsService } from './news.service';

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test</title>
    <item>
      <title>Primeira notícia &amp; teste</title>
      <link>https://example.com/a</link>
      <pubDate>Thu, 31 Oct 2026 10:00:00 GMT</pubDate>
    </item>
    <item>
      <title><![CDATA[Segunda notícia com CDATA]]></title>
      <link>https://example.com/b</link>
    </item>
  </channel>
</rss>`;

describe('NewsService', () => {
  let service: NewsService;
  const fetchMock = jest.fn();

  beforeAll(() => {
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  beforeEach(() => {
    service = new NewsService();
    fetchMock.mockReset();
  });

  it('extrai título, link e fonte do RSS', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => RSS });

    const items = await service.headlines(5);

    expect(items.length).toBeGreaterThan(0);
    expect(items[0].title).toBe('Primeira notícia & teste');
    expect(items[0].url).toBe('https://example.com/a');
    expect(items[0].source).toBeTruthy();
  });

  it('decodifica CDATA no título', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => RSS });

    const items = await service.headlines(10);

    expect(items.some((i) => i.title === 'Segunda notícia com CDATA')).toBe(true);
  });

  it('não quebra quando todos os feeds falham', async () => {
    fetchMock.mockRejectedValue(new Error('network'));

    const items = await service.headlines(5);

    expect(items).toEqual([]);
  });
});
