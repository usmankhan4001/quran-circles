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
import { createTranslator } from '../i18n/translate';

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

  it('keeps the figures left to right on an Urdu screen, after the part of the day', () => {
    const FSI = '\u2068';
    const PDI = '\u2069';
    const clock = formatClockTime(INSTANT, 'Asia/Karachi', 'ur');
    expect(clock).toBe(`رات ${FSI}9:30${PDI}`);
    expect(formatLocalTime('21:00', 'ur')).toContain(FSI);
    // A date and time isolates only the figures, so the date reads right to left around them.
    const both = formatDateTime(INSTANT, 'Asia/Karachi', 'ur');
    const start = both.indexOf(FSI);
    const end = both.indexOf(PDI);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(both.slice(start + 1, end)).toBe('9:30');
    expect(both.slice(0, start)).toMatch(/15/);
    expect(both.slice(0, start)).toMatch(/، رات $/);
  });

  describe('Urdu times (A-09)', () => {
    const plain = (text: string) => text.replace(/[\u2066-\u2069]/g, '');

    it('names the part of the day in Urdu before the figures', () => {
      expect(plain(formatLocalTime('21:00', 'ur'))).toBe('رات 9:00');
      expect(plain(formatLocalTime('05:15', 'ur'))).toBe('صبح 5:15');
      expect(plain(formatLocalTime('12:30', 'ur'))).toBe('دوپہر 12:30');
      expect(plain(formatLocalTime('17:45', 'ur'))).toBe('شام 5:45');
      expect(plain(formatLocalTime('00:05', 'ur'))).toBe('رات 12:05');
      // 21:30 in Pakistan is 16:30 UTC.
      expect(plain(formatClockTime(INSTANT, 'Asia/Karachi', 'ur'))).toBe('رات 9:30');
      expect(plain(formatClockTime(INSTANT, 'UTC', 'ur'))).toBe('شام 4:30');
    });

    it('has no Latin letters and no narrow no-break space', () => {
      const outputs = [
        ...[
          '00:00',
          '03:59',
          '04:00',
          '11:59',
          '12:00',
          '15:59',
          '16:00',
          '18:59',
          '19:00',
          '23:59',
        ].map((t) => formatLocalTime(t, 'ur')),
        formatClockTime(INSTANT, 'Asia/Karachi', 'ur'),
        formatDateTime(INSTANT, 'Asia/Karachi', 'ur'),
      ];
      for (const text of outputs) {
        expect(text).not.toMatch(/[A-Za-z]/);
        expect(text).not.toContain('\u202f');
      }
    });

    it('says "بجے" once in a schedule line', () => {
      const ur = createTranslator('ur');
      const line = plain(ur('session.schedule.everyDay', { time: formatLocalTime('21:00', 'ur') }));
      expect(line).toBe('ہر روز رات 9:00 بجے');
      expect(line.split('بجے')).toHaveLength(2);
    });

    it('keeps the time in the session’s zone for an unknown zone, falling back to Pakistan', () => {
      expect(plain(formatClockTime(INSTANT, 'Not/AZone', 'ur'))).toBe('رات 9:30');
    });
  });

  it('leaves English times as they are', () => {
    expect(formatClockTime(INSTANT, 'Asia/Karachi', 'en')).not.toContain('\u2068');
    expect(formatDateTime(INSTANT, 'Asia/Karachi', 'en')).not.toContain('\u2068');
    expect(formatLocalTime('21:00', 'en')).toMatch(/^9:00 pm$/i);
    expect(formatDateTime(INSTANT, 'Asia/Karachi', 'en')).toMatch(/^Mon, 15 Feb, 9:30 pm$/i);
  });

  it('writes a plain space where the browser puts a narrow no-break space before "pm"', () => {
    // `format` is a getter that returns a bound function; wrap what it returns, as newer
    // browsers do, with U+202F before "pm".
    const proto = Intl.DateTimeFormat.prototype;
    const original = Object.getOwnPropertyDescriptor(proto, 'format')!;
    let wrapped = 0;
    Object.defineProperty(proto, 'format', {
      configurable: true,
      get(this: Intl.DateTimeFormat) {
        const real = original.get!.call(this) as (date?: Date | number) => string;
        wrapped += 1;
        return (date?: Date | number) => real(date).replace(' ', '\u202f');
      },
    });
    try {
      // 16:30 UTC is 20:30 in Dubai (UTC+4).
      const text = formatClockTime(INSTANT, 'Asia/Dubai', 'en');
      expect(wrapped).toBeGreaterThan(0);
      expect(text).toMatch(/^8:30 pm$/i);
      expect(text).not.toContain('\u202f');
    } finally {
      Object.defineProperty(proto, 'format', original);
    }
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
