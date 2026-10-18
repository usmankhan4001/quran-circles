import type { RateLimitBucket } from '@qc/contracts';

export interface RateLimitRule {
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the caller may try again. 0 when allowed. */
  retryAfterSeconds: number;
}

/** The hook the API uses. A shared store (Redis, Postgres) can replace the in-memory one later. */
export interface RateLimiter {
  consume(key: string, rule: RateLimitRule, nowMs: number): Promise<RateLimitResult>;
}

/** Numbers per bucket from docs/engineering/conventions.md. Tuned in one place. */
export const DEFAULT_RATE_LIMITS: Record<RateLimitBucket, RateLimitRule> = {
  default: { limit: 300, windowSeconds: 60 },
  auth_code: { limit: 5, windowSeconds: 600 },
  registration: { limit: 20, windowSeconds: 60 },
  messaging: { limit: 30, windowSeconds: 60 },
};

interface Counter {
  windowStart: number;
  count: number;
}

/**
 * Fixed-window counters in memory. With several API processes (`API_PROCESSES`) the cluster primary
 * keeps the one instance and the processes ask it (`shared-limits.ts`), so limits stay exact.
 */
export class MemoryRateLimiter implements RateLimiter {
  private readonly counters = new Map<string, Counter>();
  private lastSweep = 0;

  async consume(key: string, rule: RateLimitRule, nowMs: number): Promise<RateLimitResult> {
    this.sweep(nowMs, rule.windowSeconds * 1000);
    const windowMs = rule.windowSeconds * 1000;
    const current = this.counters.get(key);
    if (!current || nowMs - current.windowStart >= windowMs) {
      this.counters.set(key, { windowStart: nowMs, count: 1 });
      return { allowed: true, retryAfterSeconds: 0 };
    }
    if (current.count >= rule.limit) {
      const retry = Math.max(1, Math.ceil((current.windowStart + windowMs - nowMs) / 1000));
      return { allowed: false, retryAfterSeconds: retry };
    }
    current.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }

  /** Forget every counter. For tests. */
  reset(): void {
    this.counters.clear();
    this.lastSweep = 0;
  }

  private sweep(nowMs: number, windowMs: number): void {
    if (nowMs - this.lastSweep < 60_000) return;
    this.lastSweep = nowMs;
    for (const [key, c] of this.counters) {
      if (nowMs - c.windowStart >= Math.max(windowMs, 600_000)) this.counters.delete(key);
    }
  }
}
