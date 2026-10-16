import { describe, expect, it } from 'vitest';
import { createFakeQuranApi, fakeArabic, fakeUrdu } from '../test/fakes';
import { ALQURAN_CLOUD_BASE_URL, createAlQuranCloudSource } from './alquranCloud';
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
  it('asks for the Arabic and Urdu editions of a surah in one request, like V1', async () => {
    const { api, source } = setup();
    await source.getSurah(112);
    expect(api.calls).toEqual([
      `${ALQURAN_CLOUD_BASE_URL}/surah/112/editions/quran-uthmani,ur.maududi`,
    ]);
  });

  it('returns each ayah with its Arabic and Urdu text', async () => {
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
    });
  });

  it('asks for a juz one edition at a time, because the combined request failed in V1', async () => {
    const { api, source } = setup();
    const passage = await source.getJuz(30);
    expect(api.calls.sort()).toEqual([
      `${ALQURAN_CLOUD_BASE_URL}/juz/30/quran-uthmani`,
      `${ALQURAN_CLOUD_BASE_URL}/juz/30/ur.maududi`,
    ]);
    expect(passage.kind).toBe('juz');
    expect(passage.verses[0]).toMatchObject({ surah: 78, ayah: 1 });
    expect(passage.verses.at(-1)).toMatchObject({ surah: 114, ayah: 6 });
    expect(passage.verses).toHaveLength(564);
  });

  it('matches the translation by ayah number, so a missing one leaves a gap and shifts nothing', async () => {
    const { api, source } = setup();
    api.withoutTranslation = true;
    const passage = await source.getSurah(112);
    expect(passage.verses.every((v) => v.urdu === null)).toBe(true);
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
