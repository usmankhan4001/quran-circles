import { describe, expect, it } from 'vitest';
import { formatClockTime } from '../../core/format';
import { splitClock } from './clock';

describe('splitClock', () => {
  it('splits an English time into figures and the part of the day', () => {
    expect(splitClock('7:30 pm')).toEqual({
      clock: '7:30',
      period: 'pm',
      periodFirst: false,
      latinPeriod: true,
    });
  });

  it('drops the isolate marks the Urdu formatter adds, keeping a Latin "PM" after the figures', () => {
    expect(splitClock('⁨9:00 PM⁩')).toEqual({
      clock: '9:00',
      period: 'PM',
      periodFirst: false,
      latinPeriod: true,
    });
  });

  it('keeps an Urdu part of the day that is read before the figures', () => {
    expect(splitClock('رات ⁨9:00⁩')).toEqual({
      clock: '9:00',
      period: 'رات',
      periodFirst: true,
      latinPeriod: false,
    });
  });

  it('reads Urdu digits as figures', () => {
    expect(splitClock('۹:۰۰ رات').clock).toBe('۹:۰۰');
  });

  it('gives a 24-hour time with no period back as figures only', () => {
    expect(splitClock('21:00')).toEqual({
      clock: '21:00',
      period: '',
      periodFirst: false,
      latinPeriod: false,
    });
  });

  it('returns text with no clock whole', () => {
    expect(splitClock('Starting now')).toEqual({
      clock: 'Starting now',
      period: '',
      periodFirst: false,
      latinPeriod: false,
    });
  });

  it('splits what the app formatter really produces, in both languages', () => {
    const instant = '2027-02-18T16:30:00Z';
    for (const locale of ['en', 'ur'] as const) {
      const parts = splitClock(formatClockTime(instant, 'Asia/Karachi', locale));
      expect(parts.clock).toBe('9:30');
      expect(parts.period).not.toBe('');
      expect(parts.clock + parts.period).not.toMatch(/[⁦-⁩]/);
    }
  });
});
