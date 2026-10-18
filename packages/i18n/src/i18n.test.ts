import { describe, expect, it } from 'vitest';
import { messages, TIME_PERIOD_KEYS, timePeriodKey } from './index';

const keys = (o: Record<string, string>) => Object.keys(o).filter((k) => !k.startsWith('_'));

describe('translations', () => {
  it('has the same keys in English and Urdu', () => {
    expect(keys(messages.ur).sort()).toEqual(keys(messages.en).sort());
  });

  it('has no empty values', () => {
    for (const locale of ['en', 'ur'] as const) {
      for (const k of keys(messages[locale])) {
        expect((messages[locale] as Record<string, string>)[k]?.trim()).toBeTruthy();
      }
    }
  });
});

describe('time.period', () => {
  it('has a part of the day for every band, in English and Urdu', () => {
    for (const key of TIME_PERIOD_KEYS) {
      expect(messages.en[key]).toBeTruthy();
      expect(messages.ur[key]).toBeTruthy();
      expect(messages.ur[key]).not.toMatch(/[A-Za-z]/);
    }
  });

  it('uses the same words as the poster renderer', () => {
    for (const band of ['lateNight', 'morning', 'noon', 'evening', 'night'] as const) {
      for (const locale of ['en', 'ur'] as const) {
        expect(messages[locale][`time.period.${band}`]).toBe(
          messages[locale][`poster.period.${band}`],
        );
      }
    }
  });

  it.each([
    [0, 'time.period.lateNight'],
    [3, 'time.period.lateNight'],
    [4, 'time.period.morning'],
    [5, 'time.period.morning'],
    [11, 'time.period.morning'],
    [12, 'time.period.noon'],
    [15, 'time.period.noon'],
    [16, 'time.period.evening'],
    [18, 'time.period.evening'],
    [19, 'time.period.night'],
    [21, 'time.period.night'],
    [23, 'time.period.night'],
    [24, 'time.period.lateNight'],
    [-1, 'time.period.night'],
  ] as const)('puts hour %i in %s', (hour, key) => {
    expect(timePeriodKey(hour)).toBe(key);
  });

  it('names 21:00 "رات", 05:15 "صبح" and 12:30 "دوپہر" in Urdu', () => {
    expect(messages.ur[timePeriodKey(21)]).toBe('رات');
    expect(messages.ur[timePeriodKey(5)]).toBe('صبح');
    expect(messages.ur[timePeriodKey(12)]).toBe('دوپہر');
  });
});
