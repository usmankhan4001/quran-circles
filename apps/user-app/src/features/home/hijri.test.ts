import { messages } from '@qc/i18n';
import { describe, expect, it } from 'vitest';
import { HIJRI_MONTH_KEYS, hijriToday } from './hijri';

// 2027-02-15, 13:00 in Pakistan: 8 Ramadan 1448 on the Umm al-Qura table.
const NOON_PKT = new Date('2027-02-15T08:00:00Z');

describe('hijriToday', () => {
  it('gives the Hijri date of the day in Pakistan', () => {
    expect(hijriToday(NOON_PKT, 0)).toEqual({ year: 1448, month: 9, day: 8 });
  });

  it('applies the admin offset from config', () => {
    expect(hijriToday(NOON_PKT, 1)).toEqual({ year: 1448, month: 9, day: 9 });
    expect(hijriToday(NOON_PKT, -1)).toEqual({ year: 1448, month: 9, day: 7 });
    expect(hijriToday(NOON_PKT, 2)).toEqual({ year: 1448, month: 9, day: 10 });
  });

  it('keeps an offset inside the allowed range', () => {
    expect(hijriToday(NOON_PKT, 5)).toEqual(hijriToday(NOON_PKT, 2));
  });

  it('turns the day at midnight Pakistan time, not at midnight UTC', () => {
    // 23:59 in Pakistan is still the 15th; 00:00 is the 16th (19:00 UTC).
    expect(hijriToday(new Date('2027-02-15T18:59:00Z'), 0)).toEqual({
      year: 1448,
      month: 9,
      day: 8,
    });
    expect(hijriToday(new Date('2027-02-15T19:00:00Z'), 0)).toEqual({
      year: 1448,
      month: 9,
      day: 9,
    });
    expect(hijriToday(new Date('2027-02-15T19:00:00Z'), -1)).toEqual({
      year: 1448,
      month: 9,
      day: 8,
    });
  });

  it('is null outside the calendar table', () => {
    expect(hijriToday(new Date('2200-01-01T00:00:00Z'), 0)).toBeNull();
  });

  it('has a month name in both languages for every month', () => {
    expect(HIJRI_MONTH_KEYS).toHaveLength(12);
    for (const key of HIJRI_MONTH_KEYS) {
      expect(messages.en[key]).toBeTruthy();
      expect(messages.ur[key]).toBeTruthy();
    }
  });
});
