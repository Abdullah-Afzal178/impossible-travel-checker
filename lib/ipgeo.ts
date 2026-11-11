import "server-only";

import { API_BASE, FIELDS, itemProblem, parseBulk, parseItem, requestProblem, type Item, type Problem, type SecurityState } from "@/lib/api";
import { isPrivateIp } from "@/lib/query";
import { rateLimitFromEnv, takeLookup } from "@/lib/rate-limit";
import { getSessionCache, setSessionCache } from "@/lib/session-cache";

const TIMEOUT_MS = 10000;
/** IP data barely moves within an hour; identical checks reuse the answer. */
const CACHE_MS = 60 * 60 * 1000;

export type Lookup =
  | {
      ok: true;
      /** One item per IP, in the order asked. */
      items: Item[];
      security: SecurityState;
    }
  | { ok: false; limited: boolean; problem: Problem };

/**
 * Location, network and Security data for the IPs (one or two), in a single
 * /ipgeo-bulk call. Plans without the Security module or the bulk endpoint,
 * and a Security outage, fall back to plain single lookups so the travel
 * check still works.
 */
export async function lookupIps(ips: string[], visitor: string | null): Promise<Lookup> {
  const apiKey = process.env.IPGEOLOCATION_API_KEY;

  if (!apiKey) {
    return { ok: false, limited: false, problem: { title: "No API key", message: "Set IPGEOLOCATION_API_KEY in your .env file to look up IP addresses." } };
  }

  const key = `ips:${ips.join(",")}`;
  const cached = getSessionCache<Extract<Lookup, { ok: true }>>(key);

  if (cached) {
    return cached;
  }

  const limit = rateLimitFromEnv();
  const allowed = takeLookup(visitor ?? "unknown", limit);

  if (!allowed.ok) {
    const minutes = Math.max(1, Math.ceil(allowed.retryMs / 60000));

    return {
      ok: false,
      limited: true,
      problem: {
        title: "Taking a short break",
        message: `This page allows ${limit.max} new check${limit.max === 1 ? "" : "s"} every ${Math.round(limit.windowMs / 60000)} minutes per visitor, to keep it free for everyone. Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}, or use the API directly.`,
      },
    };
  }

  const result = await lookupLive(apiKey, ips);

  // An answer missing Security data because of an outage is kept briefly, so it clears up on its own.
  if (result.ok) {
    setSessionCache(key, result, result.security === "unavailable" ? 5 * 60 * 1000 : CACHE_MS);
  }

  return result;
}

async function lookupLive(apiKey: string, ips: string[]): Promise<Lookup> {
  const bulk = await call(`${API_BASE}/ipgeo-bulk?apiKey=${encodeURIComponent(apiKey)}&include=security&fields=${FIELDS},security`, {
    method: "POST",
    body: JSON.stringify({ ips }),
  });

  if (bulk.status === 200) {
    const items = parseBulk(bulk.body, ips);

    if (items) {
      return { ok: true, items, security: "ok" };
    }
  }

  if (bulk.status === 429) {
    return { ok: false, limited: false, problem: requestProblem(429) };
  }

  // 401/403: the plan lacks Security or bulk (or the key is bad, which the
  // single lookups will show). 5xx or no answer: Security is having trouble.
  const security: SecurityState = bulk.status === 401 || bulk.status === 403 ? "paid" : "unavailable";
  const items: Item[] = [];

  for (const ip of ips) {
    const single = await call(`${API_BASE}/ipgeo?apiKey=${encodeURIComponent(apiKey)}&ip=${encodeURIComponent(ip)}&fields=${FIELDS}`, { method: "GET" });

    if (single.status === 200) {
      items.push(parseItem(single.body, ip));
    } else if ([400, 404, 423].includes(single.status)) {
      items.push({ ok: false, problem: itemProblem(ip, single.message, single.status) });
    } else {
      return { ok: false, limited: false, problem: requestProblem(single.status, single.message) };
    }
  }

  return { ok: true, items, security };
}

async function call(url: string, init: { method: string; body?: string }): Promise<{ status: number; body: unknown; message: string }> {
  try {
    const response = await fetch(url, {
      ...init,
      cache: "no-store",
      headers: { Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}) },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    let body: unknown = null;

    try {
      body = await response.json();
    } catch {
      body = null;
    }

    const message = body && typeof body === "object" && typeof (body as { message?: unknown }).message === "string" ? (body as { message: string }).message : "";

    return { status: response.status, body, message };
  } catch {
    return { status: 0, body: null, message: "" };
  }
}

/** The visitor's own address, from the proxy headers the host sets. */
export function visitorIp(headerStore: Headers): string | null {
  for (const name of ["cf-connecting-ip", "x-real-ip", "x-vercel-forwarded-for", "x-forwarded-for"]) {
    const ip = headerStore
      .get(name)
      ?.split(",")
      .map((item) => item.trim().replace(/^\[|\]$/g, ""))
      .find((item) => /^[0-9a-f:.]+$/i.test(item) && !isPrivateIp(item));

    if (ip) {
      return ip;
    }
  }

  return null;
}
