import { describe, expect, it } from 'vitest';
import {
  DAY_KEYS,
  formatClockTime,
  formatDateTime,
  formatLocalDate,
  formatLocalTime,
  formatShortDate,
  intlLocale,
  localDateOf,
  toLocalDigits,
  weekdayOf,
} from './format';
import { messages } from '@qc/i18n';

// 2027-02-15 16:30 UTC is 21:30 in Pakistan (UTC+5), a Monday.
const INSTANT = '2027-02-15T16:30:00Z';

describe('dates and times', () => {
  it('shows the time in the session’s own time zone, whatever zone the phone is in', () => {
    expect(formatClockTime(INSTANT, 'Asia/Karachi', 'en')).toMatch(/9:30\s?pm/i);
    expect(formatClockTime(INSTANT, 'UTC', 'en')).toMatch(/4:30\s?pm/i);
  });

  it('formats a wall-clock time without moving it across zones', () => {
    expect(formatLocalTime('21:00', 'en')).toMatch(/9:00\s?pm/i);
    expect(formatLocalTime('07:05', 'en')).toMatch(/7:05\s?am/i);
  });

  it('uses Western digits in both languages', () => {
    expect(formatClockTime(INSTANT, 'Asia/Karachi', 'ur')).toMatch(/9:30/);
    expect(formatLocalDate('2027-02-18', 'ur')).toMatch(/18/);
    expect(toLocalDigits(1234, 'ur')).toBe('1234');
    expect(intlLocale('ur')).toContain('ur-PK');
    expect(intlLocale('en')).toContain('en-PK');
  });

  it('formats dates and dates with time', () => {
    expect(formatShortDate(INSTANT, 'Asia/Karachi', 'en')).toMatch(/Mon/);
    expect(formatShortDate(INSTANT, 'Asia/Karachi', 'en')).toMatch(/15/);
    expect(formatDateTime(INSTANT, 'Asia/Karachi', 'en')).toMatch(/9:30/);
    expect(formatLocalDate('2027-02-18', 'en')).toMatch(/18/);
  });

  it('finds the weekday and the date in the session’s time zone, not UTC', () => {
    // 20:00 UTC on Monday is already 01:00 Tuesday in Pakistan.
    const late = new Date('2027-02-15T20:00:00Z');
    expect(weekdayOf(late, 'UTC')).toBe(1);
    expect(weekdayOf(late, 'Asia/Karachi')).toBe(2);
    expect(localDateOf(late, 'UTC')).toBe('2027-02-15');
    expect(localDateOf(late, 'Asia/Karachi')).toBe('2027-02-16');
  });

  it('falls back to Pakistan time for a time zone it does not know', () => {
    expect(formatClockTime(INSTANT, 'Not/AZone', 'en')).toMatch(/9:30/);
  });
});

describe('DAY_KEYS', () => {
  it('has a name for every day of the week in both languages', () => {
    expect(DAY_KEYS).toHaveLength(7);
    for (const key of DAY_KEYS) {
      expect(messages.en[key]).toBeTruthy();
      expect(messages.ur[key]).toBeTruthy();
    }
    expect(messages.en[DAY_KEYS[0]]).toBe('Sunday');
  });
});
