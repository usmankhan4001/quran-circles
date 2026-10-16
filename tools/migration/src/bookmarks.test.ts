import { BookmarkImport } from '@qc/contracts';
import { describe, expect, it } from 'vitest';
import { AYAH_COUNTS, MAX_IMPORT_ITEMS, V1_BOOKMARKS_KEY, mapV1Bookmarks } from './bookmarks';

describe('AYAH_COUNTS', () => {
  it('describes the 114 surahs and 6236 ayat', () => {
    expect(AYAH_COUNTS).toHaveLength(114);
    expect(AYAH_COUNTS.reduce((a, b) => a + b, 0)).toBe(6236);
    expect(AYAH_COUNTS[0]).toBe(7); // Al-Fatihah
    expect(AYAH_COUNTS[1]).toBe(286); // Al-Baqarah, the longest
    expect(AYAH_COUNTS[113]).toBe(6); // An-Nas
    expect(Math.max(...AYAH_COUNTS)).toBe(286); // the contract allows ayah up to 286
  });
});

describe('mapV1Bookmarks', () => {
  it('reads V1 verse keys from the raw localStorage string', () => {
    const result = mapV1Bookmarks('["2:255","1:1","114:6"]');
    expect(result.payload.items).toEqual([
      { kind: 'ayah', surah: 2, ayah: 255 },
      { kind: 'ayah', surah: 1, ayah: 1 },
      { kind: 'ayah', surah: 114, ayah: 6 },
    ]);
    expect(result.stats).toEqual({ read: 3, imported: 3, invalid: 0, duplicate: 0, overLimit: 0 });
  });

  it('accepts an already-parsed array and tolerates spaces', () => {
    expect(mapV1Bookmarks([' 18 : 10 ', '36:1']).payload.items).toHaveLength(2);
  });

  it('drops repeats and keeps the first order', () => {
    const result = mapV1Bookmarks(['2:255', '1:1', '2:255', '02:255']);
    expect(result.payload.items.map((i) => `${i.surah}:${i.ayah}`)).toEqual(['2:255', '1:1']);
    expect(result.stats).toMatchObject({ read: 4, imported: 2, duplicate: 2 });
  });

  it.each([
    '0:1',
    '115:1',
    '1:0',
    '1:8', // Al-Fatihah has 7
    '2:287',
    '114:7',
    '2',
    '2:',
    ':5',
    'a:b',
    '2:255:1',
    '-1:3',
    '1.5:2',
    '',
    '  ',
  ])('counts %j as invalid', (key) => {
    const result = mapV1Bookmarks([key]);
    expect(result.payload.items).toEqual([]);
    expect(result.stats).toMatchObject({ read: 1, invalid: 1, imported: 0 });
  });

  it('counts entries that are not strings as invalid', () => {
    const result = mapV1Bookmarks([5, null, {}, ['2:255'], true, '2:255']);
    expect(result.stats).toMatchObject({ read: 6, invalid: 5, imported: 1 });
  });

  it.each([null, undefined, 42, {}, 'not json', '{"a":1}', '"2:255"', '[1,', ''])(
    'never throws and imports nothing for %j',
    (input) => {
      const result = mapV1Bookmarks(input);
      expect(result.payload.items).toEqual([]);
      expect(result.stats.imported).toBe(0);
    },
  );

  it('stops at the 500 items one import may carry and counts the rest', () => {
    const keys: string[] = [];
    for (let surah = 1; keys.length < 520; surah++) {
      for (let ayah = 1; ayah <= AYAH_COUNTS[surah - 1]! && keys.length < 520; ayah++) {
        keys.push(`${surah}:${ayah}`);
      }
    }
    const result = mapV1Bookmarks(keys);
    expect(result.payload.items).toHaveLength(MAX_IMPORT_ITEMS);
    expect(result.stats).toMatchObject({ read: 520, imported: 500, overLimit: 20 });
    expect(BookmarkImport.safeParse(result.payload).success).toBe(true);
  });

  it('produces exactly what POST /v1/me/bookmarks/import accepts', () => {
    const parsed = BookmarkImport.parse(mapV1Bookmarks(['2:255', '18:10', '112:1']).payload);
    expect(parsed.items).toHaveLength(3);
    expect(parsed.items[0]).toEqual({ kind: 'ayah', surah: 2, ayah: 255 });
  });

  it('an empty import is still a valid body', () => {
    expect(BookmarkImport.safeParse(mapV1Bookmarks([]).payload).success).toBe(true);
  });

  it('knows the key V1 used', () => {
    expect(V1_BOOKMARKS_KEY).toBe('quran_bookmarks');
  });
});
