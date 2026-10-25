import { describe, expect, it } from 'vitest';
import { createI18n } from '../i18n';
import {
  formatClock,
  formatDate,
  formatDateTime,
  formatLocalDateTime,
  formatWeekday,
  formatWeekdays,
  listSeparator,
} from './datetime';

const FSI = '\u2068';
const PDI = '\u2069';
const ISOLATES = /[\u2066-\u2069]/g;
const plain = (s: string) => s.replace(ISOLATES, '');

// 16:05 UTC is 21:05 in Pakistan (UTC+5, no daylight saving).
const INSTANT = '2026-10-25T16:05:00Z';

/** Every run of digits sits inside a first-strong isolate, so none touches an Urdu letter. */
function digitsAreIsolated(text: string): boolean {
  let depth = 0;
  for (const ch of text) {
    if (ch === FSI) depth += 1;
    else if (ch === PDI) depth -= 1;
    else if (/[0-9]/.test(ch) && depth === 0) return false;
  }
  return depth === 0;
}

describe('formatDateTime', () => {
  it('writes English with a 12-hour clock in Pakistan time and no isolation marks', () => {
    expect(formatDateTime(INSTANT, 'en')).toBe('25 Oct 2026, 9:05 pm');
    expect(formatDateTime(INSTANT, 'en')).not.toMatch(/[\u2066-\u2069\u202f]/);
  });

  it('writes Urdu as date، part of the day and figures, every figure run isolated', () => {
    const ur = formatDateTime(INSTANT, 'ur');
    expect(ur).toBe(`${FSI}25${PDI} اکتوبر، ${FSI}2026${PDI}، رات ${FSI}9:05${PDI}`);
    expect(digitsAreIsolated(ur)).toBe(true);
  });

  it('never writes a Latin AM or PM, or a narrow no-break space, in Urdu', () => {
    for (const iso of ['2026-10-25T01:00:00Z', '2026-10-25T07:30:00Z', '2026-10-25T23:59:00Z']) {
      const ur = formatDateTime(iso, 'ur');
      expect(ur).not.toMatch(/[A-Za-z]/);
      expect(ur).not.toMatch(/\u202f/);
      expect(digitsAreIsolated(ur)).toBe(true);
    }
  });

  it('moves to the next Pakistan day after 19:00 UTC', () => {
    expect(formatDateTime('2026-10-25T19:30:00Z', 'en')).toBe('26 Oct 2026, 12:30 am');
    expect(plain(formatDateTime('2026-10-25T19:30:00Z', 'ur'))).toBe('26 اکتوبر، 2026، رات 12:30');
  });

  it('returns text it cannot read unchanged, rather than "Invalid Date"', () => {
    expect(formatDateTime('not a date', 'en')).toBe('not a date');
    expect(formatDateTime('', 'ur')).toBe('');
  });
});

describe('formatDate', () => {
  it('formats a day in both languages', () => {
    expect(formatDate('2027-02-15', 'en')).toBe('15 Feb 2027');
    expect(formatDate('2027-02-15', 'ur')).toBe(`${FSI}15${PDI} فروری، ${FSI}2027${PDI}`);
  });

  it('returns a broken date unchanged', () => {
    expect(formatDate('2027-13-45', 'en')).toBe('2027-13-45');
  });
});

describe('formatClock', () => {
  it('reads a local time in both languages', () => {
    expect(formatClock('21:30', 'en')).toBe('9:30 pm');
    expect(formatClock('00:05', 'en')).toBe('12:05 am');
    expect(formatClock('21:30', 'ur')).toBe(`رات ${FSI}9:30${PDI}`);
    expect(formatClock('05:15', 'ur')).toBe(`صبح ${FSI}5:15${PDI}`);
  });

  it('returns a time it cannot read unchanged', () => {
    expect(formatClock('25:00', 'en')).toBe('25:00');
    expect(formatClock('ab:cd', 'ur')).toBe('ab:cd');
    expect(formatClock('', 'en')).toBe('');
  });
});

describe('formatLocalDateTime', () => {
  it('joins a local day and time with the language comma', () => {
    expect(formatLocalDateTime('2027-02-15', '19:00', 'en')).toBe('15 Feb 2027, 7:00 pm');
    const ur = formatLocalDateTime('2027-02-15', '19:00', 'ur');
    expect(plain(ur)).toBe('15 فروری، 2027، رات 7:00');
    expect(digitsAreIsolated(ur)).toBe(true);
  });
});

describe('weekdays', () => {
  it('names days from Sunday and joins them with the language comma', () => {
    expect(formatWeekday(0, 'en')).toBe('Sun');
    expect(formatWeekday(1, 'en', 'long')).toBe('Monday');
    expect(formatWeekdays([1, 3], 'en')).toBe('Mon, Wed');
    expect(formatWeekdays([1, 3], 'ur')).toBe('پیر، بدھ');
    expect(formatWeekdays([], 'ur')).toBe('');
    expect(listSeparator('ur')).toBe('، ');
  });
});

describe('the I18n object uses the shared helper', () => {
  it('formats through lib/datetime in both languages', () => {
    const en = createI18n('en', () => undefined);
    const ur = createI18n('ur', () => undefined);
    expect(en.dateTime(INSTANT)).toBe(formatDateTime(INSTANT, 'en'));
    expect(ur.dateTime(INSTANT)).toBe(formatDateTime(INSTANT, 'ur'));
    expect(ur.date('2027-02-15')).toBe(formatDate('2027-02-15', 'ur'));
    expect(ur.time('21:00')).toBe(formatClock('21:00', 'ur'));
    expect(ur.localDateTime('2027-02-15', '19:00')).toBe(
      formatLocalDateTime('2027-02-15', '19:00', 'ur'),
    );
    expect(ur.weekdays([2, 4])).toBe(formatWeekdays([2, 4], 'ur'));
  });
});
