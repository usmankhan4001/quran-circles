import { describe, expect, it } from 'vitest';
import { messages } from '@qc/i18n';
import { isolate } from '@qc/ui';
import {
  dayParts,
  formatInstantDate,
  formatInstantTime,
  formatLocalDate,
  formatLocalTime,
  isLocalDate,
  isLocalTime,
  isToday,
  pkDateOf,
  pkDayRange,
  pkInstant,
  pkTimeOf,
  weekdayName,
} from './time';

describe('Pakistan time', () => {
  it('shifts an instant by five hours', () => {
    expect(pkTimeOf('2027-02-15T08:00:00Z')).toBe('13:00');
    expect(pkDateOf('2027-02-15T08:00:00Z')).toBe('2027-02-15');
  });

  it('rolls into the next Pakistan day after 19:00 UTC', () => {
    expect(pkDateOf('2027-02-15T19:30:00Z')).toBe('2027-02-16');
    expect(pkTimeOf('2027-02-15T19:30:00Z')).toBe('00:30');
    expect(pkDateOf('2027-02-15T18:59:59Z')).toBe('2027-02-15');
  });

  it('bounds the Pakistan day in UTC', () => {
    expect(pkDayRange(new Date('2027-02-15T08:00:00Z'))).toEqual({
      from: '2027-02-14T19:00:00Z',
      to: '2027-02-15T18:59:59Z',
      date: '2027-02-15',
    });
    expect(pkDayRange(new Date('2027-02-15T20:00:00Z')).date).toBe('2027-02-16');
  });

  it('tells whether an instant is today in Pakistan', () => {
    const now = new Date('2027-02-15T08:00:00Z');
    expect(isToday('2027-02-15T02:00:00Z', now)).toBe(true);
    expect(isToday('2027-02-14T18:00:00Z', now)).toBe(false);
    expect(isToday('2027-02-14T19:00:00Z', now)).toBe(true);
    expect(isToday('2027-02-15T19:00:00Z', now)).toBe(false);
  });

  it('turns a local date and time into a UTC instant and back', () => {
    expect(pkInstant('2027-02-18', '19:30')).toBe('2027-02-18T14:30:00Z');
    expect(pkInstant('2027-02-18', '02:00')).toBe('2027-02-17T21:00:00Z');
    const instant = pkInstant('2027-02-18', '02:00');
    expect(pkDateOf(instant)).toBe('2027-02-18');
    expect(pkTimeOf(instant)).toBe('02:00');
  });
});

describe('formatting', () => {
  it('writes the time in 12-hour form in both languages without non-Latin digits', () => {
    expect(formatLocalTime('19:30', 'en')).toMatch(/^0?7:30\s?pm$/i);
    expect(formatLocalTime('00:05', 'en')).toMatch(/12:05\s?am/i);
    expect(formatLocalTime('19:30', 'ur')).toMatch(/7:30/);
    expect(formatLocalTime('19:30', 'ur')).not.toMatch(/[۰-۹٠-٩]/);
    expect(formatInstantTime('2027-02-15T14:30:00Z', 'en')).toMatch(/7:30\s?pm/i);
  });

  it('keeps the Urdu figures left to right, isolated after the part of the day', () => {
    const FSI = '\u2068';
    const PDI = '\u2069';
    expect(formatLocalTime('16:30', 'ur')).toBe(`شام ${FSI}4:30${PDI}`);
    expect(formatLocalTime('16:30', 'ur')).toBe(`شام ${isolate('4:30')}`);
    // 11:30 UTC is 16:30 in Pakistan.
    expect(formatInstantTime('2027-02-15T11:30:00Z', 'ur')).toBe(`شام ${isolate('4:30')}`);
    // English needs no marks.
    expect(formatLocalTime('16:30', 'en')).not.toMatch(/[\u2066-\u2069\u200e]/);
  });

  describe('Urdu times (A-09)', () => {
    const plain = (text: string) => text.replace(/[\u2066-\u2069]/g, '');

    it('names the part of the day in Urdu before the figures', () => {
      expect(plain(formatLocalTime('21:00', 'ur'))).toBe('رات 9:00');
      expect(plain(formatLocalTime('05:15', 'ur'))).toBe('صبح 5:15');
      expect(plain(formatLocalTime('12:30', 'ur'))).toBe('دوپہر 12:30');
      expect(plain(formatLocalTime('00:05', 'ur'))).toBe('رات 12:05');
      // 16:00 UTC is 21:00 in Pakistan.
      expect(plain(formatInstantTime('2027-02-15T16:00:00Z', 'ur'))).toBe('رات 9:00');
    });

    it.each([
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
    ])('writes %s with no Latin letters and no narrow no-break space', (time) => {
      const text = formatLocalTime(time, 'ur');
      expect(text).not.toMatch(/[A-Za-z]/);
      expect(text).not.toContain('\u202f');
    });

    it('says "بجے" once in a schedule line', () => {
      const line = plain(
        messages.ur['session.schedule.everyDay'].replace('{time}', formatLocalTime('21:00', 'ur')),
      );
      expect(line).toBe('ہر روز رات 9:00 بجے');
      expect(line.split('بجے')).toHaveLength(2);
    });

    it('leaves English as it was, with a plain space before "pm"', () => {
      expect(formatLocalTime('21:00', 'en')).toBe('9:00 pm');
      expect(formatLocalTime('05:15', 'en')).toBe('5:15 am');
      expect(formatLocalTime('21:00', 'en')).not.toContain('\u202f');
    });
  });

  it('writes the date with a short weekday', () => {
    expect(formatLocalDate('2027-02-18', 'en')).toMatch(/Thu/);
    expect(formatLocalDate('2027-02-18', 'en')).toMatch(/18/);
    expect(formatInstantDate('2027-02-15T08:00:00Z', 'en')).toMatch(/Mon/);
  });

  it('names weekdays from Sunday', () => {
    expect(weekdayName(0, 'en', 'long')).toBe('Sunday');
    expect(weekdayName(6, 'en', 'long')).toBe('Saturday');
    expect(weekdayName(2, 'en')).toMatch(/^Tue/);
    expect(weekdayName(0, 'ur', 'long')).not.toBe('Sunday');
  });
});

describe('validation', () => {
  it.each(['00:00', '09:05', '19:30', '23:59'])('accepts the time %s', (v) =>
    expect(isLocalTime(v)).toBe(true),
  );
  it.each(['24:00', '7:30', '19:60', '19-30', '', '1930'])('rejects the time %j', (v) =>
    expect(isLocalTime(v)).toBe(false),
  );
  it.each(['2027-02-18', '2028-02-29'])('accepts the date %s', (v) =>
    expect(isLocalDate(v)).toBe(true),
  );
  it.each(['2027-02-30', '2027-13-01', '18-02-2027', '2027-2-18', '', '2027-02-18T00:00'])(
    'rejects the date %j',
    (v) => expect(isLocalDate(v)).toBe(false),
  );
});

describe('dayParts', () => {
  it('gives the short weekday, the day and the full date in English', () => {
    expect(dayParts('2027-02-16', 'en')).toEqual({
      weekday: 'Tue',
      day: '16',
      full: 'Tuesday 16 February',
    });
  });

  it('keeps Latin digits for the day in Urdu and names the day in Urdu', () => {
    const parts = dayParts('2027-02-16', 'ur');
    expect(parts.day).toBe('16');
    expect(parts.weekday).not.toBe('Tue');
    expect(parts.full).toContain('16');
  });
});
