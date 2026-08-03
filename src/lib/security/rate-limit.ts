/**
 * In-process rate limiter using a sliding window counter.
 *
 * LIMITATION: Each serverless instance has its own Map. On Vercel with concurrent
 * instances the effective limit per key is (max × instance_count) — this is NOT
 * a distributed rate limiter. It provides coarse abuse prevention only.
 *
 * The Public API rate limiter (src/lib/public-api/rate-limit.ts) counts requests
 * in the api_logs Supabase table and is accurate across all instances.
 *
 * To make this distributed: replace the Map with Upstash Redis or a Supabase RPC.
 */

interface Entry {
  count: number;
  resetAt: number;
}

const store = new Map<string, Entry>();
let sweepCalls = 0;

function sweep(): void {
  if (++sweepCalls % 500 !== 0) return;
  const now = Date.now();
  for (const [k, v] of store) {
    if (now > v.resetAt) store.delete(k);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit(key: string, max: number, windowMs: number): RateLimitResult {
  sweep();
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: max - 1, resetAt };
  }

  if (entry.count >= max) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: max - entry.count, resetAt: entry.resetAt };
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.floor(result.resetAt / 1000)),
  };
}

export function getClientIp(request: Request): string {
  const fwd = (request.headers as Headers).get('x-forwarded-for');
  return fwd?.split(',')[0]?.trim() ?? 'unknown';
}

// Named presets — call rateLimit(key, LIMITS.auth.max, LIMITS.auth.windowMs)
export const LIMITS = {
  auth:      { max: 10,  windowMs: 15 * 60 * 1000 },  // 10 / 15 min
  invite:    { max: 10,  windowMs: 60 * 60 * 1000 },  // 10 / hr
  email:     { max: 5,   windowMs: 60 * 60 * 1000 },  // 5 / hr
  returns:   { max: 5,   windowMs: 60 * 1000 },        // 5 / min  (public submissions)
  webhooks:  { max: 60,  windowMs: 60 * 1000 },        // 60 / min
  general:   { max: 120, windowMs: 60 * 1000 },        // 120 / min
} as const;
