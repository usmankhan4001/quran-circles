import { describe, expect, it } from 'vitest';
import { surahName } from './surahName';

describe('surahName', () => {
  it('gives the transliteration in English', () => {
    expect(surahName(1, 'en')).toBe('Al-Fatihah');
    expect(surahName(13, 'en')).toBe("Ar-Ra'd");
    expect(surahName(114, 'en')).toBe('An-Nas');
  });

  it('gives the Arabic-script name in Urdu', () => {
    expect(surahName(1, 'ur')).toBe('الفاتحة');
    expect(surahName(13, 'ur')).toBe('الرعد');
  });

  it.each([0, 115, -1, 2.5, Number.NaN])('gives nothing for %j, which is not a surah', (n) => {
    expect(surahName(n, 'en')).toBeNull();
    expect(surahName(n, 'ur')).toBeNull();
  });
});
