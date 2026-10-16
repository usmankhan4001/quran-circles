import { describe, expect, it } from 'vitest';
import { messages } from '@qc/i18n';
import { toCountdown } from '../prayer/next';
import { translate, pluralKey, type ContentI18n } from './i18n';
import {
  cityName,
  clockText,
  countdownLine,
  countdownText,
  gregorianText,
  hijriText,
  isolate,
  surahName,
} from './format';
import { getSurah } from '../meta/surahs';
import { PAKISTAN_CITIES, DEFAULT_PLACE } from '../prayer/places';

const make = (locale: 'en' | 'ur'): ContentI18n => ({
  locale,
  t: (key, params) => translate(locale, key, params),
  tn: (base, count, params) => translate(locale, pluralKey(base, count), { count, ...params }),
  n: (value) => String(value),
});

describe('countdownText', () => {
  const en = make('en');
  it.each([
    [(1 * 3600 + 20 * 60) * 1000, '1 h 20 min'],
    [(3600 + 59) * 1000, '1 h 0 min'],
    [(12 * 60 + 5) * 1000, '12 min 5 s'],
    [59 * 1000, '59 s'],
    [1, '1 s'],
    [0, '0 s'],
  ])('%i ms reads %s', (ms, text) => {
    expect(countdownText(en, toCountdown(ms))).toBe(text);
  });

  it('rounds up, so it never shows 0 while time is left', () => {
    expect(countdownText(en, toCountdown(400))).toBe('1 s');
  });
});

describe('countdownLine', () => {
  it('keeps the time in one left-to-right run', () => {
    const line = countdownLine(make('ur'), 'asr', toCountdown(80 * 60_000));
    const time = countdownText(make('ur'), toCountdown(80 * 60_000));
    expect(line).toContain(isolate(time));
    expect(isolate(time)).toBe(`\u2066${time}\u2069`);
  });

  it('reads like the translation', () => {
    expect(countdownLine(make('en'), 'asr', toCountdown(80 * 60_000)).replace(/[⁦⁩]/g, '')).toBe(
      'Asr in 1 h 20 min',
    );
  });
});

describe('clockText', () => {
  it('writes the wall clock of the place with the translated AM and PM', () => {
    const at = new Date('2026-10-16T13:04:00.000Z');
    expect(clockText(make('en'), at, DEFAULT_PLACE)).toBe('6:04 PM');
    expect(clockText(make('ur'), at, DEFAULT_PLACE)).toBe(
      `6:04 ${(messages.ur as Record<string, string>)['prayer.pm']}`,
    );
  });

  it('is not moved by the time zone of the phone', () => {
    const at = new Date('2026-10-16T00:14:00.000Z');
    expect(clockText(make('en'), at, DEFAULT_PLACE)).toBe('5:14 AM');
    expect(clockText(make('en'), at, { ...DEFAULT_PLACE, utcOffsetMinutes: 0 })).toBe('12:14 AM');
  });
});

describe('dates and names', () => {
  it('writes the Gregorian and Hijri dates', () => {
    const en = make('en');
    expect(gregorianText(en, { year: 2026, month: 10, day: 16 })).toBe('Friday, 16 October 2026');
    expect(hijriText(en, { year: 1448, month: 9, day: 1 })).toBe('1 Ramadan 1448 AH');
  });

  it('names a surah in Latin letters in English and Arabic script in Urdu', () => {
    const info = getSurah(36)!;
    expect(surahName(make('en'), info)).toBe('Ya-Sin');
    expect(surahName(make('ur'), info)).toBe(info.nameArabic);
  });

  it('names every listed city in both languages', () => {
    for (const city of PAKISTAN_CITIES) {
      expect(cityName(make('en'), city)).toBe(city.name);
      expect(cityName(make('ur'), city)).toMatch(/[\u0600-\u06FF]/);
    }
  });
});

describe('translate', () => {
  it('fills placeholders and falls back to English, then to the key', () => {
    expect(translate('en', 'quran.surah.title', { name: 'X' })).toBe('Surah X');
    expect(translate('en', 'quran.juz.title', {})).toContain('{number}');
  });

  it('chooses the plural form', () => {
    expect(pluralKey('quran.surah.ayahs', 1)).toBe('quran.surah.ayahs.one');
    expect(pluralKey('quran.surah.ayahs', 0)).toBe('quran.surah.ayahs.other');
    expect(make('en').tn('quran.surah.ayahs', 7)).toBe('7 ayahs');
    expect(make('en').tn('quran.surah.ayahs', 1)).toBe('1 ayah');
  });
});
