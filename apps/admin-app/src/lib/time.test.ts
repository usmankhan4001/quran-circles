import { describe, expect, it } from 'vitest';
import { ltrRun } from '@qc/ui';
import {
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

  it('keeps an Urdu time as one left-to-right run, so it reads "4:30 PM" in a right-to-left line', () => {
    const LRM = '\u200e';
    const ur = formatLocalTime('16:30', 'ur');
    expect(ur.startsWith(LRM)).toBe(true);
    expect(ur.endsWith(LRM)).toBe(true);
    expect(ur.slice(1, -1)).toMatch(/^4:30\s?(PM|pm|\S+)$/);
    expect(ur).toBe(ltrRun(ur.slice(1, -1)));
    expect(formatInstantTime('2027-02-15T11:30:00Z', 'ur').startsWith(LRM)).toBe(true);
    // English needs no marks.
    expect(formatLocalTime('16:30', 'en')).not.toContain(LRM);
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
