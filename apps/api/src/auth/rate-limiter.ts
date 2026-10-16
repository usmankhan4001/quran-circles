import type { RateRule } from './config';

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

/**
 * Sliding-window limiter. Keys are opaque strings that never contain personal data (callers pass
 * hashed phone numbers and addresses). A denied hit is not recorded, so hammering a locked key
 * does not extend the lock.
 *
 * The in-memory version below is right for one API process. Swap in a Postgres-backed version
 * behind this interface if the API ever runs as several containers.
 */
export interface RateLimiter {
  hit(key: string, rule: RateRule, now: Date): Promise<RateLimitResult>;
  /** Forget a key, for example after a successful sign-in. */
  reset(key: string): Promise<void>;
}

interface Bucket {
  hits: number[];
  windowMs: number;
}

const MAX_KEYS = 100_000;

export class InMemoryRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  async hit(key: string, rule: RateRule, now: Date): Promise<RateLimitResult> {
    const nowMs = now.getTime();
    const windowMs = rule.windowSeconds * 1000;
    const bucket = this.buckets.get(key) ?? { hits: [], windowMs };
    bucket.windowMs = windowMs;
    bucket.hits = bucket.hits.filter((t) => t > nowMs - windowMs);
    if (bucket.hits.length >= rule.limit) {
      this.buckets.set(key, bucket);
      // The oldest hit in the window leaves it first; one slot frees up then.
      const oldest = bucket.hits[bucket.hits.length - rule.limit] ?? nowMs;
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - nowMs) / 1000)),
      };
    }
    bucket.hits.push(nowMs);
    this.buckets.set(key, bucket);
    if (this.buckets.size > MAX_KEYS) this.sweep(nowMs);
    return { allowed: true };
  }

  async reset(key: string): Promise<void> {
    this.buckets.delete(key);
  }

  /** Forget everything. For tests. */
  clear(): void {
    this.buckets.clear();
  }

  /** Drops buckets with nothing left in their window. */
  private sweep(nowMs: number): void {
    for (const [key, bucket] of this.buckets) {
      if (!bucket.hits.some((t) => t > nowMs - bucket.windowMs)) this.buckets.delete(key);
    }
  }
}
