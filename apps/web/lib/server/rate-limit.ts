import "server-only";

/**
 * Small in-memory limiter. Good enough for a single-instance MVP.
 * Phase 2: move to Redis/Supabase so limits survive restarts and scale out.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 50_000;

function sweep(now: number) {
  if (buckets.size < MAX_KEYS) return;
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}

export type LimitResult = { ok: boolean; remaining: number; resetAt: number };

/** Fixed-window counter: `limit` hits per `windowMs` for `key`. */
export function hit(key: string, limit: number, windowMs: number): LimitResult {
  const now = Date.now();
  sweep(now);
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  if (b.count >= limit) return { ok: false, remaining: 0, resetAt: b.resetAt };
  b.count += 1;
  return { ok: true, remaining: limit - b.count, resetAt: b.resetAt };
}

/** Give back one hit (e.g. when the work it paid for failed). */
export function undo(key: string) {
  const b = buckets.get(key);
  if (b && b.count > 0) b.count -= 1;
}

export function peek(key: string, limit: number): LimitResult {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) return { ok: limit > 0, remaining: limit, resetAt: now };
  return { ok: b.count < limit, remaining: Math.max(0, limit - b.count), resetAt: b.resetAt };
}

/** Best-effort client IP. Behind a proxy (Vercel, nginx) the first x-forwarded-for hop is the client. */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "local";
}

export const DAY_MS = 24 * 60 * 60 * 1000;
