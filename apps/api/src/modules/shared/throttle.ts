import type { RateLimitRule } from '../../middleware/rate-limit';
import type { AppDeps } from './context';
import { fail } from './errors';

/**
 * A per-person limit on top of the endpoint's contract bucket, for calls that are costly beyond
 * the request itself (render jobs, stored files). Same limiter and the same `rate_limited` answer
 * with `retryAfterSeconds` as the buckets. The key holds the user id, never personal data.
 */
export async function throttle(
  deps: Pick<AppDeps, 'rateLimiter'>,
  name: string,
  userId: string,
  rule: RateLimitRule,
  now: Date,
): Promise<void> {
  const result = await deps.rateLimiter.consume(`${name}:${userId}`, rule, now.getTime());
  if (!result.allowed) fail('rate_limited', { retryAfterSeconds: result.retryAfterSeconds });
}
