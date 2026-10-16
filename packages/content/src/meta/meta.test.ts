import { describe, expect, it } from 'vitest';
import {
  absoluteAyahNumber,
  clampAyah,
  formatVerseKey,
  isValidAyah,
  nextAyah,
  parseVerseKey,
} from './ayah';
import { JUZ_STARTS, juzEnd, juzOf, juzSegments, juzStart } from './juz';
import { ayahCountOf, getSurah, SURAHS, TOTAL_AYAHS } from './surahs';

describe('surah metadata', () => {
  it('lists 114 surahs, in order, whose ayah counts add up to 6,236', () => {
    expect(SURAHS).toHaveLength(114);
    SURAHS.forEach((s, i) => expect(s.id).toBe(i + 1));
    expect(SURAHS.reduce((sum, s) => sum + s.ayahCount, 0)).toBe(TOTAL_AYAHS);
  });

  it('has the well-known counts', () => {
    expect(ayahCountOf(1)).toBe(7);
    expect(ayahCountOf(2)).toBe(286);
    expect(ayahCountOf(9)).toBe(129);
    expect(ayahCountOf(36)).toBe(83);
    expect(ayahCountOf(112)).toBe(4);
    expect(ayahCountOf(114)).toBe(6);
  });

  it('gives every surah a Latin name, an Arabic name and a meaning', () => {
    for (const s of SURAHS) {
      expect(s.nameSimple.trim()).not.toBe('');
      expect(s.nameArabic.trim()).not.toBe('');
      expect(s.nameEnglish.trim()).not.toBe('');
    }
  });

  it('returns undefined outside 1 to 114', () => {
    expect(getSurah(0)).toBeUndefined();
    expect(getSurah(115)).toBeUndefined();
    expect(getSurah(1.5)).toBeUndefined();
    expect(ayahCountOf(200)).toBe(0);
  });
});

describe('ayah references', () => {
  it('formats and parses verse keys, including the V1 browser format', () => {
    expect(formatVerseKey({ surah: 2, ayah: 255 })).toBe('2:255');
    expect(parseVerseKey('2:255')).toEqual({ surah: 2, ayah: 255 });
    expect(parseVerseKey(' 36 : 1 ')).toEqual({ surah: 36, ayah: 1 });
  });

  it('rejects keys that are not an ayah that exists', () => {
    for (const bad of [
      '',
      '2',
      '2:',
      ':3',
      '0:1',
      '115:1',
      '1:8',
      '2:287',
      'a:b',
      '2:255:1',
      5,
      null,
      undefined,
      {},
    ]) {
      expect(parseVerseKey(bad)).toBeNull();
    }
  });

  it('checks and clamps ayah numbers', () => {
    expect(isValidAyah(1, 7)).toBe(true);
    expect(isValidAyah(1, 8)).toBe(false);
    expect(isValidAyah(1, 0)).toBe(false);
    expect(isValidAyah(115, 1)).toBe(false);
    expect(clampAyah(1, 99)).toBe(7);
    expect(clampAyah(1, -4)).toBe(1);
    expect(clampAyah(1, Number.NaN)).toBe(1);
    expect(clampAyah(2, 3.9)).toBe(3);
  });

  it('numbers ayahs across the whole Quran and steps over surah ends', () => {
    expect(absoluteAyahNumber({ surah: 1, ayah: 1 })).toBe(1);
    expect(absoluteAyahNumber({ surah: 2, ayah: 1 })).toBe(8);
    expect(absoluteAyahNumber({ surah: 114, ayah: 6 })).toBe(6236);
    expect(nextAyah({ surah: 1, ayah: 7 })).toEqual({ surah: 2, ayah: 1 });
    expect(nextAyah({ surah: 2, ayah: 5 })).toEqual({ surah: 2, ayah: 6 });
    expect(nextAyah({ surah: 114, ayah: 6 })).toBeNull();
  });
});

describe('juz boundaries', () => {
  it('has 30 starts in strictly increasing order, beginning at 1:1', () => {
    expect(JUZ_STARTS).toHaveLength(30);
    expect(JUZ_STARTS[0]).toEqual({ surah: 1, ayah: 1 });
    for (let i = 1; i < 30; i++) {
      const prev = JUZ_STARTS[i - 1];
      const here = JUZ_STARTS[i];
      if (!prev || !here) throw new Error('missing juz');
      expect(absoluteAyahNumber(here)).toBeGreaterThan(absoluteAyahNumber(prev));
      expect(isValidAyah(here.surah, here.ayah)).toBe(true);
    }
  });

  it('knows where a few well-known juz begin and end', () => {
    expect(juzStart(2)).toEqual({ surah: 2, ayah: 142 });
    expect(juzStart(30)).toEqual({ surah: 78, ayah: 1 });
    expect(juzEnd(1)).toEqual({ surah: 2, ayah: 141 });
    expect(juzEnd(14)).toEqual({ surah: 16, ayah: 128 });
    expect(juzEnd(30)).toEqual({ surah: 114, ayah: 6 });
    expect(() => juzStart(31)).toThrow(RangeError);
  });

  it('covers every ayah exactly once', () => {
    let total = 0;
    let previousEnd = 0;
    for (let juz = 1; juz <= 30; juz++) {
      const segments = juzSegments(juz);
      const first = segments[0];
      const last = segments[segments.length - 1];
      if (!first || !last) throw new Error('empty juz');
      expect(absoluteAyahNumber({ surah: first.surah, ayah: first.fromAyah })).toBe(
        previousEnd + 1,
      );
      previousEnd = absoluteAyahNumber({ surah: last.surah, ayah: last.toAyah });
      total += segments.reduce((sum, s) => sum + (s.toAyah - s.fromAyah + 1), 0);
    }
    expect(total).toBe(TOTAL_AYAHS);
    expect(previousEnd).toBe(TOTAL_AYAHS);
  });

  it('finds the juz of an ayah, on both sides of a boundary', () => {
    expect(juzOf({ surah: 1, ayah: 1 })).toBe(1);
    expect(juzOf({ surah: 2, ayah: 141 })).toBe(1);
    expect(juzOf({ surah: 2, ayah: 142 })).toBe(2);
    expect(juzOf({ surah: 2, ayah: 286 })).toBe(3);
    expect(juzOf({ surah: 18, ayah: 74 })).toBe(15);
    expect(juzOf({ surah: 18, ayah: 75 })).toBe(16);
    expect(juzOf({ surah: 114, ayah: 6 })).toBe(30);
  });

  it('splits a juz that crosses several surahs into segments', () => {
    expect(juzSegments(1)).toEqual([
      { surah: 1, fromAyah: 1, toAyah: 7 },
      { surah: 2, fromAyah: 1, toAyah: 141 },
    ]);
    const thirty = juzSegments(30);
    expect(thirty[0]).toEqual({ surah: 78, fromAyah: 1, toAyah: 40 });
    expect(thirty).toHaveLength(37);
  });
});
