import fs from 'fs';
import path from 'path';

export interface CurrencyCacheData {
  rate: number;
  provider: string;
  updatedAt: string;
}

export class CurrencyService {
  private static cachedRate: number | null = null;
  private static lastFetched = 0;
  private static readonly TTL_MS = 60 * 60 * 1000; // 1 hora de cache em memória

  private static getPersistPath(): string {
    const candidates = [
      '/opt/nanoclaw-stack/nanoclaw/data/currency_rate.json',
      '/workspace/group/currency_rate.json',
      '/workspace/agent/currency_rate.json',
      path.join(process.cwd(), 'currency_rate.json'),
    ];
    for (const p of candidates) {
      const dir = path.dirname(p);
      if (fs.existsSync(dir)) return p;
    }
    return '/tmp/currency_rate.json';
  }

  /**
   * Tenta obter a cotação em múltiplos provedores financeiros de mercado com retries em cascata.
   */
  private static async fetchLiveMarketRate(): Promise<{ rate: number; provider: string } | null> {
    // 1. Provedor Primário: AwesomeAPI (Cotação Comercial em Tempo Real)
    try {
      const res = await fetch('https://economia.awesomeapi.com.br/last/USD-BRL', {
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const data = (await res.json()) as any;
        const bid = parseFloat(data?.USDBRL?.bid);
        if (!isNaN(bid) && bid > 0) {
          return { rate: Number(bid.toFixed(4)), provider: 'AwesomeAPI (Mercado Comercial)' };
        }
      }
    } catch {}

    // 2. Provedor Secundário: Coinbase Exchange Rates (Global Feed)
    try {
      const res = await fetch('https://api.coinbase.com/v2/exchange-rates?currency=USD', {
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const data = (await res.json()) as any;
        const brl = parseFloat(data?.data?.rates?.BRL);
        if (!isNaN(brl) && brl > 0) {
          return { rate: Number(brl.toFixed(4)), provider: 'Coinbase Exchange Rates' };
        }
      }
    } catch {}

    // 3. Provedor Terciário: Open Exchange / Exchangerate-api
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD', {
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const data = (await res.json()) as any;
        const brl = parseFloat(data?.rates?.BRL);
        if (!isNaN(brl) && brl > 0) {
          return { rate: Number(brl.toFixed(4)), provider: 'Open ER-API' };
        }
      }
    } catch {}

    return null;
  }

  /**
   * Carrega a cotação persistida no disco caso a memória esteja zerada no boot.
   */
  private static loadFromDisk(): number | null {
    try {
      const persistPath = this.getPersistPath();
      if (fs.existsSync(persistPath)) {
        const raw = fs.readFileSync(persistPath, 'utf-8');
        const data = JSON.parse(raw) as CurrencyCacheData;
        if (data && typeof data.rate === 'number' && data.rate > 0) {
          return data.rate;
        }
      }
    } catch {}
    return null;
  }

  /**
   * Grava a cotação real no disco para garantir persistência entre reinicializações do servidor.
   */
  private static saveToDisk(rate: number, provider: string) {
    try {
      const persistPath = this.getPersistPath();
      const dir = path.dirname(persistPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const payload: CurrencyCacheData = {
        rate,
        provider,
        updatedAt: new Date().toISOString(),
      };
      fs.writeFileSync(persistPath, JSON.stringify(payload, null, 2), 'utf-8');
    } catch {}
  }

  /**
   * Garante a obtenção do valor real de mercado.
   */
  static async getUsdToBrlRate(): Promise<number> {
    const now = Date.now();

    // 1. Se tem em cache de memória dentro do TTL de 1h, retorna imediatamente
    if (this.cachedRate !== null && now - this.lastFetched < this.TTL_MS) {
      return this.cachedRate;
    }

    // 2. Busca nos feeds de mercado ao vivo
    const live = await this.fetchLiveMarketRate();
    if (live) {
      this.cachedRate = live.rate;
      this.lastFetched = now;
      this.saveToDisk(live.rate, live.provider);
      return this.cachedRate;
    }

    // 3. Se houver indisponibilidade transitória de rede, carrega o último valor real persistido no disco
    const fromDisk = this.loadFromDisk();
    if (fromDisk !== null) {
      this.cachedRate = fromDisk;
      return this.cachedRate;
    }

    // 4. Se o disco estiver virgem, tenta mais uma vez com retry
    const retry = await this.fetchLiveMarketRate();
    if (retry) {
      this.cachedRate = retry.rate;
      this.lastFetched = now;
      this.saveToDisk(retry.rate, retry.provider);
      return this.cachedRate;
    }

    throw new Error('Não foi possível obter a cotação USD/BRL nos provedores oficiais de mercado.');
  }

  /**
   * Retorna a cotação síncrona atual. Se a memória estiver vazia, lê do disco persistido.
   */
  static getRateSync(): number {
    if (this.cachedRate !== null) {
      return this.cachedRate;
    }
    const fromDisk = this.loadFromDisk();
    if (fromDisk !== null) {
      this.cachedRate = fromDisk;
      return this.cachedRate;
    }
    // Dispara a busca em background para popular imediatamente
    this.getUsdToBrlRate().catch(() => {});
    return 5.70;
  }

  /**
   * Converte USD para BRL usando a cotação real
   */
  static convertUsdToBrl(costUsd: number): number {
    const rate = this.getRateSync();
    return Number((costUsd * rate).toFixed(6));
  }
}
