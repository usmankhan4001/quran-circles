import { describe, expect, it } from 'vitest';
import { pickTime } from './dbstats';

const at = (iso: string): Date => new Date(iso);

describe('pickTime', () => {
  const times = [
    at('2026-03-20T18:00:05.000Z'),
    null,
    at('2026-03-20T18:00:01.000Z'),
    at('2026-03-20T18:00:09.000Z'),
  ];

  it('gives the earliest time with Math.min (regression: reduce(Math.min) gave NaN)', () => {
    expect(pickTime(times, Math.min)).toBe('2026-03-20T18:00:01.000Z');
  });

  it('gives the latest time with Math.max', () => {
    expect(pickTime(times, Math.max)).toBe('2026-03-20T18:00:09.000Z');
  });

  it('works with two values and does not throw "Invalid time value"', () => {
    const two = [at('2026-03-20T18:00:02.000Z'), at('2026-03-20T18:00:03.000Z')];
    expect(() => pickTime(two, Math.min)).not.toThrow();
    expect(pickTime(two, Math.min)).toBe('2026-03-20T18:00:02.000Z');
    expect(pickTime(two, Math.max)).toBe('2026-03-20T18:00:03.000Z');
  });

  it('returns the only value when there is one', () => {
    expect(pickTime([at('2026-03-20T18:00:04.000Z')], Math.min)).toBe('2026-03-20T18:00:04.000Z');
  });

  it('returns null for an empty list or only nulls', () => {
    expect(pickTime([], Math.min)).toBeNull();
    expect(pickTime([null, null], Math.max)).toBeNull();
  });
});
