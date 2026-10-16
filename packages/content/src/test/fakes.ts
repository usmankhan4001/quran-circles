import { absoluteAyahNumber } from '../meta/ayah';
import { juzSegments } from '../meta/juz';
import { ayahCountOf } from '../meta/surahs';
import type { QuranVerse } from '../quran/types';

/**
 * Invented placeholder text for tests. It is not the Quran and not a translation: every string
 * says FAKE so nobody mistakes it for the real thing. The opening-formula placeholder is four
 * words, like the real one, because the reader splits by word count.
 */
export const FAKE_OPENING = 'FAKE-OPEN-1 FAKE-OPEN-2 FAKE-OPEN-3 FAKE-OPEN-4';
export const fakeArabic = (surah: number, ayah: number): string => {
  const body = `FAKE-AR ${surah}:${ayah}`;
  return ayah === 1 && surah !== 1 && surah !== 9 ? `${FAKE_OPENING} ${body}` : body;
};
export const fakeUrdu = (surah: number, ayah: number): string => `FAKE-UR ${surah}:${ayah}`;

export const fakeVerse = (surah: number, ayah: number, urdu = true): QuranVerse => ({
  surah,
  ayah,
  arabic: fakeArabic(surah, ayah),
  urdu: urdu ? fakeUrdu(surah, ayah) : null,
});

interface FakeAyah {
  number: number;
  numberInSurah: number;
  text: string;
  surah?: { number: number };
}

const ayahOf = (surah: number, ayah: number, text: string, withSurah: boolean): FakeAyah => ({
  number: absoluteAyahNumber({ surah, ayah }),
  numberInSurah: ayah,
  text,
  ...(withSurah ? { surah: { number: surah } } : {}),
});

export interface FakeQuranApi {
  fetch: typeof fetch;
  /** Every URL requested, in order. */
  calls: string[];
  /** While true, every request fails like a dropped connection. */
  offline: boolean;
  /** Answer the next request with this status instead of data. */
  failNextWith?: number;
  /** Answer with a body that is not valid JSON for the source. */
  garbage: boolean;
  /** Leave the translation out of every response. */
  withoutTranslation: boolean;
}

/** A stand-in for api.alquran.cloud that serves invented text. */
export function createFakeQuranApi(): FakeQuranApi {
  const api: FakeQuranApi = {
    calls: [],
    offline: false,
    garbage: false,
    withoutTranslation: false,
    fetch: ((input: RequestInfo | URL) => {
      const url = String(input);
      api.calls.push(url);
      if (api.offline) return Promise.reject(new TypeError('Failed to fetch'));
      if (api.failNextWith !== undefined) {
        const status = api.failNextWith;
        api.failNextWith = undefined;
        return Promise.resolve(new Response('{}', { status }));
      }
      if (api.garbage) return Promise.resolve(new Response('{"status":"OK","data":{"nope":1}}'));

      const surahMatch = /\/surah\/(\d+)\/editions\/([^,]+),(.+)$/.exec(url);
      if (surahMatch) {
        const surah = Number(surahMatch[1]);
        const count = ayahCountOf(surah);
        if (count === 0) return Promise.resolve(new Response('{}', { status: 404 }));
        const arabic = Array.from({ length: count }, (_, i) =>
          ayahOf(surah, i + 1, fakeArabic(surah, i + 1), false),
        );
        const urdu = api.withoutTranslation
          ? []
          : Array.from({ length: count }, (_, i) =>
              ayahOf(surah, i + 1, fakeUrdu(surah, i + 1), false),
            );
        return Promise.resolve(json({ status: 'OK', data: [{ ayahs: arabic }, { ayahs: urdu }] }));
      }

      const juzMatch = /\/juz\/(\d+)\/(.+)$/.exec(url);
      if (juzMatch) {
        const juz = Number(juzMatch[1]);
        const edition = juzMatch[2] ?? '';
        const isArabic = edition === 'quran-uthmani';
        const ayahs = juzSegments(juz).flatMap((seg) =>
          Array.from({ length: seg.toAyah - seg.fromAyah + 1 }, (_, i) => {
            const ayah = seg.fromAyah + i;
            if (isArabic) return ayahOf(seg.surah, ayah, fakeArabic(seg.surah, ayah), true);
            if (api.withoutTranslation) return null;
            return ayahOf(seg.surah, ayah, fakeUrdu(seg.surah, ayah), true);
          }).filter((a): a is FakeAyah => a !== null),
        );
        return Promise.resolve(json({ status: 'OK', data: { ayahs } }));
      }
      return Promise.resolve(new Response('{}', { status: 404 }));
    }) as typeof fetch,
  };
  return api;
}

const json = (body: unknown): Response =>
  new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });

/** A clock tests can move. */
export function createClock(start = '2026-10-16T12:00:00.000Z') {
  let current = new Date(start).getTime();
  return {
    now: () => new Date(current),
    advance: (ms: number) => {
      current += ms;
    },
    set: (iso: string) => {
      current = new Date(iso).getTime();
    },
  };
}
