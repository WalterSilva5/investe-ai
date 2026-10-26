import { Injectable, Logger } from '@nestjs/common';

const BCB = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs';
const CACHE_TTL_MS = 60 * 60 * 1000;

@Injectable()
export class MacroService {
  private readonly logger = new Logger(MacroService.name);
  private cache: { data: unknown; at: number } | null = null;

  async getMacro() {
    if (this.cache && Date.now() - this.cache.at < CACHE_TTL_MS) {
      return this.cache.data;
    }

    try {
      const [selic, ipcaMonthly, cdiDaily] = await Promise.all([
        this.lastValue(432),
        this.lastValue(433),
        this.lastValue(12),
      ]);

      const data = {
        available: true,
        selic: selic,
        ipcaMonthly,
        ipcaAnnual: (Math.pow(1 + ipcaMonthly / 100, 12) - 1) * 100,
        cdiDaily,
        cdiAnnual: (Math.pow(1 + cdiDaily / 100, 252) - 1) * 100,
        source: 'BCB SGS (séries 432, 433, 12)',
        fetchedAt: new Date().toISOString(),
      };

      this.cache = { data, at: Date.now() };
      return data;
    } catch (error) {
      this.logger.warn(`Falha ao buscar macro no BCB: ${(error as Error).message}`);
      return {
        available: false,
        error: 'Não foi possível consultar o BCB agora.',
        fetchedAt: new Date().toISOString(),
      };
    }
  }

  private async lastValue(code: number): Promise<number> {
    const response = await fetch(`${BCB}.${code}/dados/ultimos/1?formato=json`);
    if (!response.ok) throw new Error(`BCB ${code}: HTTP ${response.status}`);
    const data = (await response.json()) as Array<{ valor: string }>;
    if (!data.length) throw new Error(`BCB ${code}: série vazia`);
    return Number(data[0].valor.replace(',', '.'));
  }
}
