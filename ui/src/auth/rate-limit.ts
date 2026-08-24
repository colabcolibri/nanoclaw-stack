interface BucketConfig {
  /** Máximo de requisições permitidas dentro da janela. */
  limit: number;
  /** Janela em milissegundos. */
  windowMs: number;
}

interface HitRecord {
  timestamps: number[];
}

const buckets = new Map<string, HitRecord>();

// Evita crescimento ilimitado do Map em memória.
const MAX_TRACKED_KEYS = 10_000;

export class RateLimiter {
  /**
   * Registra um hit e informa se a requisição é permitida.
   * Janela deslizante por chave (ex.: IP + rota).
   */
  static check(key: string, config: BucketConfig): { allowed: boolean; retryAfterSeconds: number } {
    const now = Date.now();
    let record = buckets.get(key);
    if (!record) {
      if (buckets.size >= MAX_TRACKED_KEYS) {
        // Descarta as entradas mais antigas antes de criar novas.
        const oldest = [...buckets.entries()].sort(
          (a, b) => (a[1].timestamps[0] ?? 0) - (b[1].timestamps[0] ?? 0),
        );
        for (const [k] of oldest.slice(0, Math.floor(MAX_TRACKED_KEYS / 10))) buckets.delete(k);
      }
      record = { timestamps: [] };
      buckets.set(key, record);
    }

    record.timestamps = record.timestamps.filter((t) => now - t < config.windowMs);
    if (record.timestamps.length >= config.limit) {
      const oldestHit = record.timestamps[0];
      const retryAfterSeconds = Math.max(1, Math.ceil((oldestHit + config.windowMs - now) / 1000));
      return { allowed: false, retryAfterSeconds };
    }

    record.timestamps.push(now);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  static reset(): void {
    buckets.clear();
  }
}

export function clientIpFromRequest(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "local";
}
