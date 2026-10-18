import { describe, expect, it } from 'vitest';
import { formatDate, formatTime, formatWhen } from './format';
import { SAMPLE_SESSION } from './sample';
import { t } from './strings';

describe('formatTime', () => {
  it('writes a 12-hour time with Western digits in both languages', () => {
    expect(formatTime('21:30', 'en')).toBe('9:30 pm');
    expect(formatTime('00:15', 'en')).toBe('12:15 am');
    expect(formatTime('12:00', 'en')).toBe('12:00 pm');
    expect(formatTime('21:30', 'ur')).toBe('رات 9:30');
    expect(formatTime('06:00', 'ur')).toBe('صبح 6:00');
    expect(formatTime('13:45', 'ur')).toBe('دوپہر 1:45');
    expect(formatTime('17:10', 'ur')).toBe('شام 5:10');
    expect(formatTime('02:00', 'ur')).toBe('رات 2:00');
  });
});

describe('formatWhen', () => {
  it('describes a weekly session with the shared schedule wording', () => {
    expect(formatWhen(SAMPLE_SESSION, 'en')).toBe('Every Friday at 9:30 pm');
    expect(formatWhen(SAMPLE_SESSION, 'ur')).toBe('ہر جمعہ کو رات 9:30 بجے');
  });

  it('lists several days in week order', () => {
    const s = { ...SAMPLE_SESSION, daysOfWeek: [5, 1, 3] };
    expect(formatWhen(s, 'en')).toBe('Every Monday, Wednesday and Friday at 9:30 pm');
    expect(formatWhen(s, 'ur')).toBe('ہر پیر، بدھ اور جمعہ کو رات 9:30 بجے');
  });

  it('says every day for a daily session', () => {
    const s = { ...SAMPLE_SESSION, daysOfWeek: [0, 1, 2, 3, 4, 5, 6] };
    expect(formatWhen(s, 'en')).toBe('Every day at 9:30 pm');
    expect(formatWhen(s, 'ur')).toBe('ہر روز رات 9:30 بجے');
  });

  it('prints the date of a one-off lecture', () => {
    const s = {
      ...SAMPLE_SESSION,
      daysOfWeek: [],
      startsOn: '2026-11-07',
      localStartTime: '10:00',
    };
    expect(formatWhen(s, 'en')).toBe('Saturday 7 November 2026 at 10:00 am');
    expect(formatWhen(s, 'ur')).toBe('ہفتہ، 7 نومبر، 2026، صبح 10:00 بجے');
    expect(formatDate('2026-01-04', 'en')).toBe('Sunday 4 January 2026');
  });
});

describe('strings', () => {
  it('has every poster string in English and Urdu, and reads shared keys from @qc/i18n', () => {
    expect(t('en', 'app.name')).toBe('Quran Circles');
    expect(t('ur', 'app.name')).toBe('Quran Circles');
    expect(t('ur', 'poster.scanToRegister')).toMatch(/[؀-ۿ]/);
    expect(() => t('en', 'no.such.key' as never)).toThrow(RangeError);
  });
});
