export class CurrencyService {
  private static cachedRate = 5.75;
  private static lastFetched = 0;
  private static readonly TTL_MS = 60 * 60 * 1000; // 1 hora de cache

  /**
   * Obtém a cotação comercial atual do USD -> BRL com cache de 1 hora.
   * Se houver falha de rede, usa o último valor conhecido ou 5.75 como fallback.
   */
  static async getUsdToBrlRate(): Promise<number> {
    const now = Date.now();
    if (now - this.lastFetched < this.TTL_MS && this.cachedRate > 0) {
      return this.cachedRate;
    }

    try {
      const res = await fetch("https://economia.awesomeapi.com.br/last/USD-BRL", {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const data = (await res.json()) as any;
        const bid = parseFloat(data?.USDBRL?.bid);
        if (!isNaN(bid) && bid > 0) {
          this.cachedRate = Number(bid.toFixed(4));
          this.lastFetched = now;
        }
      }
    } catch {
      // Mantém cachedRate de fallback
    }

    return this.cachedRate;
  }

  /**
   * Retorna a taxa síncrona atual (usada para loops rápidos e cálculos imediatos)
   */
  static getRateSync(): number {
    return this.cachedRate;
  }

  /**
   * Converte USD para BRL
   */
  static convertUsdToBrl(costUsd: number): number {
    return Number((costUsd * this.cachedRate).toFixed(6));
  }
}
