import "server-only";

/**
 * Jednoduchý limit počtu pokusů v paměti serverové instance (posuvné okno).
 * Doplňuje vestavěné limity Supabase Auth. V serverless prostředí platí
 * pro každou instanci zvlášť – pro přísnější ochranu zapněte v Supabase
 * CAPTCHA (viz README).
 */
const buckets = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (v.every((t) => now - t >= windowMs)) buckets.delete(k);
  }
  return true;
}
