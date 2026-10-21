/** Jednoduchý okénkový limit v paměti procesu (stačí pro jednu instanci; při škálování nahradit Redisem). */
const hits = new Map<string, number[]>();

export function rateLimited(key: string, max: number, windowMs: number): boolean {
  if (process.env.RATE_LIMIT_DISABLED === "1") return false;
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => t > now - windowMs);
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 10_000) for (const [k, v] of hits) if (v[v.length - 1] < now - windowMs) hits.delete(k);
  return arr.length > max;
}
