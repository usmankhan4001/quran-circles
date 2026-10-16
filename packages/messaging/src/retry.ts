/**
 * Retry and backoff for outbox sends. Pure: the worker passes the number of attempts made so far
 * and gets back either a delay or the verdict that the message is dead.
 */
export interface RetryPolicy {
  /** Total tries, including the first. After this many failed tries the message is dead. */
  maxAttempts: number;
  baseDelayMs: number;
  factor: number;
  maxDelayMs: number;
  /** 0.2 means the delay varies by up to 20 percent either way, so retries do not bunch up. */
  jitterRatio: number;
}

/** 30 s, 2 min, 8 min, 32 min between five tries. */
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 5,
  baseDelayMs: 30_000,
  factor: 4,
  maxDelayMs: 2 * 60 * 60 * 1000,
  jitterRatio: 0.2,
};

export type RetryDecision = { kind: 'retry'; delayMs: number } | { kind: 'dead' };

/**
 * @param attemptsMade tries made so far, counting the one that just failed (1 after the first failure)
 * @param hintMs a provider's own retry-after, honoured when it is longer than the computed delay
 * @param random a number in [0, 1); injectable so tests are deterministic
 */
export function decideRetry(
  attemptsMade: number,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
  options: { hintMs?: number; random?: () => number } = {},
): RetryDecision {
  if (attemptsMade >= policy.maxAttempts) return { kind: 'dead' };
  const exponent = Math.max(0, attemptsMade - 1);
  const raw = Math.min(policy.maxDelayMs, policy.baseDelayMs * policy.factor ** exponent);
  const random = options.random ?? Math.random;
  const jitter = 1 + (random() * 2 - 1) * policy.jitterRatio;
  let delay = Math.round(raw * jitter);
  if (options.hintMs !== undefined && options.hintMs > delay) delay = options.hintMs;
  return { kind: 'retry', delayMs: Math.min(policy.maxDelayMs, Math.max(1_000, delay)) };
}
