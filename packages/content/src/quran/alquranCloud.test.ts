import { describe, expect, it } from 'vitest';
import { createFakeQuranApi, fakeArabic, fakeEnglish, fakeUrdu } from '../test/fakes';
import { ALQURAN_CLOUD_BASE_URL, DEFAULT_EDITIONS, createAlQuranCloudSource } from './alquranCloud';
import { QuranSourceError } from './types';

const setup = () => {
  const api = createFakeQuranApi();
  const source = createAlQuranCloudSource({
    fetch: api.fetch,
    now: () => new Date('2026-10-16T12:00:00.000Z'),
  });
  return { api, source };
};

describe('createAlQuranCloudSource', () => {
  it('asks for the Arabic, Urdu and English editions of a surah in one request', async () => {
    const { api, source } = setup();
    await source.getSurah(112);
    expect(api.calls).toEqual([
      `${ALQURAN_CLOUD_BASE_URL}/surah/112/editions/quran-uthmani,ur.maududi,en.maududi`,
    ]);
  });

  it("uses Maududi's English translation by default, next to his Urdu one", () => {
    expect(DEFAULT_EDITIONS).toEqual({
      arabic: 'quran-uthmani',
      urdu: 'ur.maududi',
      english: 'en.maududi',
    });
  });

  it('returns each ayah with its Arabic, Urdu and English text', async () => {
    const { source } = setup();
    const passage = await source.getSurah(112);
    expect(passage).toMatchObject({
      kind: 'surah',
      id: 112,
      fromCache: false,
      stale: false,
      fetchedAt: '2026-10-16T12:00:00.000Z',
    });
    expect(passage.verses).toHaveLength(4);
    expect(passage.verses[1]).toEqual({
      surah: 112,
      ayah: 2,
      arabic: fakeArabic(112, 2),
      urdu: fakeUrdu(112, 2),
      english: fakeEnglish(112, 2),
    });
  });

  it('asks for a juz one edition at a time, because the combined request failed in V1', async () => {
    const { api, source } = setup();
    const passage = await source.getJuz(30);
    expect(api.calls.sort()).toEqual([
      `${ALQURAN_CLOUD_BASE_URL}/juz/30/en.maududi`,
      `${ALQURAN_CLOUD_BASE_URL}/juz/30/quran-uthmani`,
      `${ALQURAN_CLOUD_BASE_URL}/juz/30/ur.maududi`,
    ]);
    expect(passage.verses[10]).toEqual({
      surah: 78,
      ayah: 11,
      arabic: fakeArabic(78, 11),
      urdu: fakeUrdu(78, 11),
      english: fakeEnglish(78, 11),
    });
    expect(passage.kind).toBe('juz');
    expect(passage.verses[0]).toMatchObject({ surah: 78, ayah: 1 });
    expect(passage.verses.at(-1)).toMatchObject({ surah: 114, ayah: 6 });
    expect(passage.verses).toHaveLength(564);
  });

  it('matches the translation by ayah number, so a missing one leaves a gap and shifts nothing', async () => {
    const { api, source } = setup();
    api.withoutTranslation = true;
    const passage = await source.getSurah(112);
    expect(passage.verses.every((v) => v.urdu === null && v.english === null)).toBe(true);
    expect(passage.verses.map((v) => v.arabic)).toEqual(
      [1, 2, 3, 4].map((a) => fakeArabic(112, a)),
    );
  });

  it('rejects surahs and juz that do not exist without a request', async () => {
    const { api, source } = setup();
    await expect(source.getSurah(0)).rejects.toMatchObject({ code: 'not_found' });
    await expect(source.getSurah(115)).rejects.toMatchObject({ code: 'not_found' });
    await expect(source.getJuz(31)).rejects.toMatchObject({ code: 'not_found' });
    expect(api.calls).toEqual([]);
  });

  it('reports a dropped connection as offline', async () => {
    const { api, source } = setup();
    api.offline = true;
    await expect(source.getSurah(1)).rejects.toMatchObject({
      name: 'QuranSourceError',
      code: 'offline',
    });
  });

  it('reports an error status as unavailable and a 404 as not found', async () => {
    const { api, source } = setup();
    api.failNextWith = 503;
    await expect(source.getSurah(1)).rejects.toMatchObject({ code: 'unavailable' });
    api.failNextWith = 404;
    await expect(source.getSurah(1)).rejects.toMatchObject({ code: 'not_found' });
  });

  it('reports an answer it cannot read as invalid', async () => {
    const { api, source } = setup();
    api.garbage = true;
    await expect(source.getSurah(1)).rejects.toBeInstanceOf(QuranSourceError);
    await expect(source.getSurah(1)).rejects.toMatchObject({ code: 'invalid_response' });
    await expect(source.getJuz(1)).rejects.toMatchObject({ code: 'invalid_response' });
  });

  describe('getAyah', () => {
    it('asks for one ayah in all three editions in one request, not the whole surah', async () => {
      const { api, source } = setup();
      const result = await source.getAyah(2, 255);
      expect(api.calls).toEqual([
        `${ALQURAN_CLOUD_BASE_URL}/ayah/2:255/editions/quran-uthmani,ur.maududi,en.maududi`,
      ]);
      expect(result).toEqual({
        verse: {
          surah: 2,
          ayah: 255,
          arabic: fakeArabic(2, 255),
          urdu: fakeUrdu(2, 255),
          english: fakeEnglish(2, 255),
        },
        fromCache: false,
        stale: false,
        fetchedAt: '2026-10-16T12:00:00.000Z',
      });
    });

    it('keeps the opening formula on ayah 1, like the passage does', async () => {
      const { source } = setup();
      const result = await source.getAyah(18, 1);
      expect(result.verse.arabic).toBe(fakeArabic(18, 1));
    });

    it('gives a null translation when the edition has none', async () => {
      const { api, source } = setup();
      api.withoutTranslation = true;
      const result = await source.getAyah(112, 1);
      expect(result.verse.urdu).toBeNull();
      expect(result.verse.english).toBeNull();
      expect(result.verse.arabic).toBe(fakeArabic(112, 1));
    });

    it('rejects an ayah that does not exist without a request', async () => {
      const { api, source } = setup();
      await expect(source.getAyah(1, 8)).rejects.toMatchObject({ code: 'not_found' });
      await expect(source.getAyah(0, 1)).rejects.toMatchObject({ code: 'not_found' });
      await expect(source.getAyah(2, 0)).rejects.toMatchObject({ code: 'not_found' });
      await expect(source.getAyah(2, 1.5)).rejects.toMatchObject({ code: 'not_found' });
      expect(api.calls).toEqual([]);
    });

    it('reports offline, error statuses and unreadable answers like the other reads', async () => {
      const { api, source } = setup();
      api.offline = true;
      await expect(source.getAyah(1, 1)).rejects.toMatchObject({ code: 'offline' });
      api.offline = false;
      api.failNextWith = 503;
      await expect(source.getAyah(1, 1)).rejects.toMatchObject({ code: 'unavailable' });
      api.failNextWith = 404;
      await expect(source.getAyah(1, 1)).rejects.toMatchObject({ code: 'not_found' });
      api.garbage = true;
      await expect(source.getAyah(1, 1)).rejects.toMatchObject({ code: 'invalid_response' });
    });

    it('refuses an answer for a different ayah than the one asked for', async () => {
      const source = createAlQuranCloudSource({
        fetch: (() =>
          Promise.resolve(
            new Response(
              JSON.stringify({
                status: 'OK',
                data: [
                  { number: 9, numberInSurah: 2, text: 'FAKE-AR 2:2', surah: { number: 2 } },
                  { number: 9, numberInSurah: 2, text: 'FAKE-UR 2:2', surah: { number: 2 } },
                ],
              }),
            ),
          )) as typeof fetch,
      });
      await expect(source.getAyah(2, 3)).rejects.toMatchObject({ code: 'invalid_response' });
    });

    it('drops a translation that belongs to another ayah', async () => {
      const source = createAlQuranCloudSource({
        fetch: (() =>
          Promise.resolve(
            new Response(
              JSON.stringify({
                status: 'OK',
                data: [
                  { number: 10, numberInSurah: 3, text: 'FAKE-AR 2:3', surah: { number: 2 } },
                  { number: 11, numberInSurah: 4, text: 'FAKE-UR 2:4', surah: { number: 2 } },
                ],
              }),
            ),
          )) as typeof fetch,
      });
      const result = await source.getAyah(2, 3);
      expect(result.verse).toEqual({
        surah: 2,
        ayah: 3,
        arabic: 'FAKE-AR 2:3',
        urdu: null,
        english: null,
      });
    });

    it('drops an English translation that belongs to another ayah, and keeps the Urdu', async () => {
      const source = createAlQuranCloudSource({
        fetch: (() =>
          Promise.resolve(
            new Response(
              JSON.stringify({
                status: 'OK',
                data: [
                  { number: 10, numberInSurah: 3, text: 'FAKE-AR 2:3', surah: { number: 2 } },
                  { number: 10, numberInSurah: 3, text: 'FAKE-UR 2:3', surah: { number: 2 } },
                  { number: 11, numberInSurah: 4, text: 'FAKE-EN 2:4', surah: { number: 2 } },
                ],
              }),
            ),
          )) as typeof fetch,
      });
      const result = await source.getAyah(2, 3);
      expect(result.verse).toEqual({
        surah: 2,
        ayah: 3,
        arabic: 'FAKE-AR 2:3',
        urdu: 'FAKE-UR 2:3',
        english: null,
      });
    });
  });

  describe('the English edition', () => {
    const modes = ['missing', 'empty', 'unreadable'] as const;

    it.each(modes)(
      'reads a surah with no English when the edition is %s, keeping Arabic and Urdu',
      async (mode) => {
        const { api, source } = setup();
        api.english = mode;
        const passage = await source.getSurah(112);
        expect(passage.verses).toHaveLength(4);
        expect(passage.verses[2]).toEqual({
          surah: 112,
          ayah: 3,
          arabic: fakeArabic(112, 3),
          urdu: fakeUrdu(112, 3),
          english: null,
        });
        expect(api.calls).toHaveLength(1);
      },
    );

    it.each(modes)('reads a juz with no English when the edition is %s', async (mode) => {
      const { api, source } = setup();
      api.english = mode;
      const passage = await source.getJuz(30);
      expect(passage.verses).toHaveLength(564);
      expect(passage.verses.every((v) => v.english === null)).toBe(true);
      expect(passage.verses[0]).toMatchObject({ arabic: fakeArabic(78, 1), urdu: fakeUrdu(78, 1) });
    });

    it.each(modes)('reads a single ayah with no English when the edition is %s', async (mode) => {
      const { api, source } = setup();
      api.english = mode;
      const result = await source.getAyah(2, 255);
      expect(result.verse).toEqual({
        surah: 2,
        ayah: 255,
        arabic: fakeArabic(2, 255),
        urdu: fakeUrdu(2, 255),
        english: null,
      });
    });

    it('matches the English by ayah number too, so a gap in it shifts nothing', async () => {
      const source = createAlQuranCloudSource({
        fetch: (() =>
          Promise.resolve(
            new Response(
              JSON.stringify({
                status: 'OK',
                data: [
                  {
                    ayahs: [1, 2, 3].map((a) => ({
                      number: a,
                      numberInSurah: a,
                      text: `FAKE-AR 1:${a}`,
                    })),
                  },
                  {
                    ayahs: [1, 2, 3].map((a) => ({
                      number: a,
                      numberInSurah: a,
                      text: `FAKE-UR 1:${a}`,
                    })),
                  },
                  // No English for ayah 2, and a blank one for ayah 3.
                  {
                    ayahs: [
                      { number: 1, numberInSurah: 1, text: 'FAKE-EN 1:1' },
                      { number: 3, numberInSurah: 3, text: '  ' },
                    ],
                  },
                ],
              }),
            ),
          )) as typeof fetch,
      });
      const passage = await source.getSurah(1);
      expect(passage.verses.map((v) => v.english)).toEqual(['FAKE-EN 1:1', null, null]);
      expect(passage.verses.map((v) => v.urdu)).toEqual([
        'FAKE-UR 1:1',
        'FAKE-UR 1:2',
        'FAKE-UR 1:3',
      ]);
    });

    it('still fails a juz when the English request loses the connection, so a cache keeps its copy', async () => {
      const calls: string[] = [];
      const api = createFakeQuranApi();
      const source = createAlQuranCloudSource({
        fetch: ((input: RequestInfo | URL, init?: RequestInit) => {
          calls.push(String(input));
          if (String(input).endsWith('/en.maududi')) {
            return Promise.reject(new TypeError('Failed to fetch'));
          }
          return api.fetch(input, init);
        }) as typeof fetch,
      });
      await expect(source.getJuz(30)).rejects.toMatchObject({ code: 'offline' });
      expect(calls).toHaveLength(3);
    });

    it('still fails a juz when the English request answers with an error status', async () => {
      const api = createFakeQuranApi();
      const source = createAlQuranCloudSource({
        fetch: ((input: RequestInfo | URL, init?: RequestInit) =>
          String(input).endsWith('/en.maududi')
            ? Promise.resolve(new Response('{}', { status: 503 }))
            : api.fetch(input, init)) as typeof fetch,
      });
      await expect(source.getJuz(30)).rejects.toMatchObject({ code: 'unavailable' });
    });

    it('takes other edition ids, and asks for no English when given none', async () => {
      const api = createFakeQuranApi();
      const custom = createAlQuranCloudSource({
        fetch: api.fetch,
        editions: { arabic: 'quran-uthmani', urdu: 'ur.other', english: 'en.other' },
      });
      const passage = await custom.getSurah(112);
      expect(api.calls).toEqual([
        `${ALQURAN_CLOUD_BASE_URL}/surah/112/editions/quran-uthmani,ur.other,en.other`,
      ]);
      expect(passage.verses[0]?.english).toBe(fakeEnglish(112, 1));

      api.calls.length = 0;
      const without = createAlQuranCloudSource({
        fetch: api.fetch,
        editions: { arabic: 'quran-uthmani', urdu: 'ur.maududi' },
      });
      const surah = await without.getSurah(112);
      await without.getAyah(112, 1);
      const juz = await without.getJuz(30);
      expect(api.calls.sort()).toEqual([
        `${ALQURAN_CLOUD_BASE_URL}/ayah/112:1/editions/quran-uthmani,ur.maududi`,
        `${ALQURAN_CLOUD_BASE_URL}/juz/30/quran-uthmani`,
        `${ALQURAN_CLOUD_BASE_URL}/juz/30/ur.maududi`,
        `${ALQURAN_CLOUD_BASE_URL}/surah/112/editions/quran-uthmani,ur.maududi`,
      ]);
      expect(surah.verses.every((v) => v.english === null && v.urdu !== null)).toBe(true);
      expect(juz.verses.every((v) => v.english === null)).toBe(true);
    });

    it('still refuses an answer without the Urdu edition, as before', async () => {
      const source = createAlQuranCloudSource({
        fetch: (() =>
          Promise.resolve(
            new Response(
              JSON.stringify({
                status: 'OK',
                data: [{ ayahs: [{ number: 1, numberInSurah: 1, text: 'FAKE-AR 1:1' }] }],
              }),
            ),
          )) as typeof fetch,
      });
      await expect(source.getSurah(1)).rejects.toMatchObject({ code: 'invalid_response' });
      await expect(source.getAyah(1, 1)).rejects.toMatchObject({ code: 'invalid_response' });
    });
  });

  it('lets an aborted request through as an abort, not as offline', async () => {
    const controller = new AbortController();
    const source = createAlQuranCloudSource({
      fetch: ((_: RequestInfo | URL, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        })) as typeof fetch,
    });
    const pending = source.getSurah(1, { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
});
