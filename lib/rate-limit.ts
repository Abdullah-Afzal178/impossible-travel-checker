/**
 * A small in-memory limit on API lookups per visitor. Each comparison costs
 * credits, so a public deployment shouldn't let one visitor spend them all.
 * Memory only: it resets on restart and isn't shared between instances,
 * which is enough to stop casual abuse.
 */

export type RateLimit = { max: number; windowMs: number };

const hits = new Map<string, number[]>();

/** Reads RATE_LIMIT_LOOKUPS and RATE_LIMIT_WINDOW_MINUTES, with safe defaults. */
export function rateLimitFromEnv(env: Record<string, string | undefined> = process.env): RateLimit {
  const max = Number.parseInt(env.RATE_LIMIT_LOOKUPS ?? "", 10);
  const minutes = Number.parseFloat(env.RATE_LIMIT_WINDOW_MINUTES ?? "");

  return {
    max: Number.isFinite(max) && max >= 0 ? max : 12,
    windowMs: (Number.isFinite(minutes) && minutes > 0 ? minutes : 10) * 60000,
  };
}

/**
 * Records one lookup for `visitor` if the limit allows it. Returns how long
 * to wait, in ms, when it doesn't. A limit of 0 turns the check off.
 */
export function takeLookup(visitor: string, limit: RateLimit, now = Date.now()): { ok: true } | { ok: false; retryMs: number } {
  if (limit.max === 0) {
    return { ok: true };
  }

  const recent = (hits.get(visitor) ?? []).filter((at) => now - at < limit.windowMs);

  if (recent.length >= limit.max) {
    hits.set(visitor, recent);

    return { ok: false, retryMs: limit.windowMs - (now - recent[0]) };
  }

  recent.push(now);
  hits.set(visitor, recent);

  // Keep the map from growing without bound on a busy server.
  if (hits.size > 5000) {
    for (const [key, times] of hits) {
      if (times.every((at) => now - at >= limit.windowMs)) {
        hits.delete(key);
      }
    }
  }

  return { ok: true };
}

export function resetRateLimits() {
  hits.clear();
}
