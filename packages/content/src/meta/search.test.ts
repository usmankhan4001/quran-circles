import { describe, expect, it } from 'vitest';
import { normalizeScript, searchSurahs, soundKey } from './search';

const ids = (query: string) => searchSurahs(query).map((r) => r.surah.id);

describe('searchSurahs', () => {
  it('returns all 114 in order for an empty query', () => {
    expect(ids('')).toHaveLength(114);
    expect(ids('   ')[0]).toBe(1);
  });

  it('finds a surah by its number', () => {
    expect(ids('18')).toEqual([18]);
    expect(ids('115')).toEqual([]);
    expect(searchSurahs('36')[0]?.matchedBy).toBe('number');
  });

  describe('English transliteration', () => {
    it('finds by the full name with or without the article and the hyphen', () => {
      expect(ids('Al-Baqarah')[0]).toBe(2);
      expect(ids('al baqarah')[0]).toBe(2);
      expect(ids('baqarah')[0]).toBe(2);
      expect(ids('BAQARAH')[0]).toBe(2);
      expect(ids('Ar-Rahman')[0]).toBe(55);
      expect(ids('Ash-Shams')[0]).toBe(91);
    });

    it('finds by the start of a name or a later word', () => {
      expect(ids('baq')[0]).toBe(2);
      expect(ids('bar')).toContain(14);
      expect(ids('imran')[0]).toBe(3);
      expect(ids('kah')[0]).toBe(18);
    });

    it('ignores a leading "surah"', () => {
      expect(ids('Surah Yusuf')[0]).toBe(12);
      expect(ids('surat al-kahf')[0]).toBe(18);
    });
  });

  describe('Urdu transliteration (Roman Urdu spellings)', () => {
    it.each([
      ['Yaseen', 36],
      ['Yasin', 36],
      ['Rehman', 55],
      ['Rahmaan', 55],
      ['Kausar', 108],
      ['Kosar', 108],
      ['Ikhlaas', 112],
      ['Fateha', 1],
      ['Tauba', 9],
      ['Bani Israel', 17],
      ['Aal-e-Imran', 3],
      ['Yousuf', 12],
      ['Kahaf', 18],
      ['Maryam', 19],
      ['Mariam', 19],
      ['Waqia', 56],
      ['Kafiroon', 109],
      ['Baqra', 2],
    ])('%s finds surah %i first', (query, id) => {
      expect(ids(query)[0]).toBe(id);
    });

    it('says how a match was made', () => {
      expect(searchSurahs('Yaseen')[0]?.matchedBy).toMatch(/name|sound/);
      expect(searchSurahs('Kafiroon')[0]?.matchedBy).toBe('sound');
    });
  });

  it('finds by the English meaning', () => {
    expect(ids('cow')[0]).toBe(2);
    expect(ids('cave')[0]).toBe(18);
    expect(searchSurahs('cave')[0]?.matchedBy).toBe('meaning');
  });

  describe('Arabic and Urdu script', () => {
    it('finds by the Arabic name, with or without the article', () => {
      expect(ids('البقرة')[0]).toBe(2);
      expect(ids('بقرة')[0]).toBe(2);
    });

    it('treats the Urdu spelling of the same letters as equal', () => {
      expect(ids('البقرہ')[0]).toBe(2);
      expect(ids('الکہف')[0]).toBe(18);
      expect(ids('سورۃ یوسف')[0]).toBe(12);
    });

    it('ignores vowel marks', () => {
      expect(ids('ٱلْفَاتِحَة')[0]).toBe(1);
    });
  });

  it('returns nothing for a query that matches no name', () => {
    expect(ids('zzzzzz')).toEqual([]);
    expect(ids('!!!')).toEqual([]);
  });

  it('ranks an exact name above a looser match', () => {
    const results = ids('nas');
    expect(results[0]).toBe(114);
  });
});

describe('key helpers', () => {
  it('soundKey makes spellings of one name equal', () => {
    expect(soundKey('Yaseen')).toBe(soundKey('Ya-Sin'));
    expect(soundKey('Rehman')).toBe(soundKey('Rahman'));
    expect(soundKey('Kausar')).toBe(soundKey('Kawthar'));
  });

  it('normalizeScript folds letter variants and drops marks', () => {
    expect(normalizeScript('البقرة')).toBe(normalizeScript('البقرہ'));
    expect(normalizeScript('سورة الكهف')).toBe(normalizeScript('کہف'));
  });
});
