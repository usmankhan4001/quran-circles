import { describe, expect, it } from 'vitest';
import { waitOf } from './wait';

describe('waitOf', () => {
  it.each([
    [1, { unit: 'seconds', count: 1 }],
    [30, { unit: 'seconds', count: 30 }],
    [0.4, { unit: 'seconds', count: 1 }],
    [58.5, { unit: 'seconds', count: 59 }],
  ])('says %j seconds in seconds while under a minute, rounded up', (seconds, wait) => {
    expect(waitOf(seconds)).toEqual(wait);
  });

  it.each([
    [59.2, { unit: 'minutes', count: 1 }],
    [60, { unit: 'minutes', count: 1 }],
    [120, { unit: 'minutes', count: 2 }],
    [61, { unit: 'aboutMinutes', count: 2 }],
    [847, { unit: 'aboutMinutes', count: 15 }],
    [900, { unit: 'minutes', count: 15 }],
    [5339, { unit: 'aboutMinutes', count: 89 }],
  ])('says %j seconds in minutes, rounded up and "about" when not whole', (seconds, wait) => {
    expect(waitOf(seconds)).toEqual(wait);
  });

  it.each([
    [5400, { unit: 'aboutHours', count: 2 }],
    [7200, { unit: 'hours', count: 2 }],
    [3 * 3600 + 1, { unit: 'aboutHours', count: 4 }],
    [86_400, { unit: 'hours', count: 24 }],
  ])('says %j seconds in hours from an hour and a half', (seconds, wait) => {
    expect(waitOf(seconds)).toEqual(wait);
  });

  it.each([null, undefined, 0, -5, Number.NaN, Number.POSITIVE_INFINITY])(
    'gives nothing for an unusable wait (%j)',
    (seconds) => {
      expect(waitOf(seconds)).toBeNull();
    },
  );
});
