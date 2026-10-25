import { describe, expect, it } from 'vitest';
import { messages } from '@qc/i18n';
import { surahLabel, surahName, surahNumbered } from './surahs';

const FSI = '\u2068';
const PDI = '\u2069';

describe('surah names', () => {
  it('names a surah in English and in Arabic script for Urdu', () => {
    expect(surahName(13, 'en')).toBe("Ar-Ra'd");
    expect(surahName(13, 'ur')).toBe('الرعد');
    expect(surahName(1, 'en')).toBe('Al-Fatihah');
    expect(surahName(114, 'ur')).toBe('الناس');
  });

  it('has no name for a number that is not a surah', () => {
    for (const n of [0, 115, -1, 2.5, Number.NaN]) {
      expect(surahName(n, 'en')).toBeUndefined();
      expect(surahName(n, 'ur')).toBeUndefined();
    }
  });
});

describe('surahLabel', () => {
  it('gives the name with its number, isolated in Urdu', () => {
    expect(surahLabel(13, 'en')).toBe("Ar-Ra'd (13)");
    expect(surahLabel(13, 'ur')).toBe(`${FSI}الرعد${PDI} (${FSI}13${PDI})`);
  });

  it('uses the number formatter it is given', () => {
    expect(surahLabel(2, 'en', (n) => `#${n}`)).toBe('Al-Baqarah (#2)');
  });

  it('falls back to the bare number for a number that is not a surah', () => {
    expect(surahLabel(200, 'en')).toBe('200');
    expect(surahLabel(0, 'ur')).toBe(`${FSI}0${PDI}`);
  });

  it('reads "Surah Ar-Ra\'d (13), ayah 28" instead of "Surah 13, ayah 28"', () => {
    const filled = messages.en['console.dailyAyahs.ref']
      .replace('{surah}', surahLabel(13, 'en'))
      .replace('{ayah}', '28');
    expect(filled).toBe("Surah Ar-Ra'd (13), ayah 28");
  });
});

describe('surahNumbered', () => {
  it('puts the number first for a list in surah order', () => {
    expect(surahNumbered(2, 'en')).toBe('2 · Al-Baqarah');
    expect(surahNumbered(2, 'ur')).toBe(`${FSI}2${PDI} · البقرة`);
    expect(surahNumbered(115, 'en')).toBe('115');
  });
});
