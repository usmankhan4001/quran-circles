import { describe, expect, it } from 'vitest';
import { DEFAULT_RETRY_POLICY, decideRetry, type RetryPolicy } from './retry';

const noJitter: RetryPolicy = { ...DEFAULT_RETRY_POLICY, jitterRatio: 0 };

describe('retry decisions', () => {
  it.each([
    [1, 30_000],
    [2, 120_000],
    [3, 480_000],
    [4, 1_920_000],
  ])('after failure %i waits %i ms', (attempts, delay) => {
    expect(decideRetry(attempts, noJitter)).toEqual({ kind: 'retry', delayMs: delay });
  });

  it('is dead once the attempts are used up', () => {
    expect(decideRetry(5, noJitter)).toEqual({ kind: 'dead' });
    expect(decideRetry(6, noJitter)).toEqual({ kind: 'dead' });
  });

  it('caps the delay', () => {
    const policy: RetryPolicy = { ...noJitter, maxAttempts: 20 };
    expect(decideRetry(12, policy)).toEqual({ kind: 'retry', delayMs: policy.maxDelayMs });
  });

  it('spreads retries with jitter inside the configured band', () => {
    const low = decideRetry(1, DEFAULT_RETRY_POLICY, { random: () => 0 });
    const high = decideRetry(1, DEFAULT_RETRY_POLICY, { random: () => 0.999999 });
    expect(low).toEqual({ kind: 'retry', delayMs: 24_000 });
    expect(high.kind === 'retry' && high.delayMs).toBeGreaterThan(35_000);
    expect(high.kind === 'retry' && high.delayMs).toBeLessThanOrEqual(36_000);
  });

  it('honours a longer retry-after hint from the provider', () => {
    expect(decideRetry(1, noJitter, { hintMs: 600_000 })).toEqual({ kind: 'retry', delayMs: 600_000 });
    expect(decideRetry(1, noJitter, { hintMs: 1_000 })).toEqual({ kind: 'retry', delayMs: 30_000 });
  });
});
