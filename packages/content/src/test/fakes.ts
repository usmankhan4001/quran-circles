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
export const fakeEnglish = (surah: number, ayah: number): string => `FAKE-EN ${surah}:${ayah}`;

export const fakeVerse = (
  surah: number,
  ayah: number,
  urdu = true,
  english = true,
): QuranVerse => ({
  surah,
  ayah,
  arabic: fakeArabic(surah, ayah),
  urdu: urdu ? fakeUrdu(surah, ayah) : null,
  english: english ? fakeEnglish(surah, ayah) : null,
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
  /** Leave the translations (Urdu and English) out of every response. */
  withoutTranslation: boolean;
  /**
   * How the English edition is answered. `full`: like the others. `missing`: left out of a
   * combined answer, and a 404 for a juz. `empty`: there, with no ayahs (combined surah, juz)
   * or an empty text (single ayah). `unreadable`: there, in a shape the source cannot read.
   */
  english: 'full' | 'missing' | 'empty' | 'unreadable';
}

const editionOf = (id: string): 'arabic' | 'urdu' | 'english' | null => {
  if (id === 'quran-uthmani') return 'arabic';
  if (id.startsWith('ur.')) return 'urdu';
  if (id.startsWith('en.')) return 'english';
  return null;
};
const textOf = (edition: 'arabic' | 'urdu' | 'english', surah: number, ayah: number): string =>
  edition === 'arabic'
    ? fakeArabic(surah, ayah)
    : edition === 'urdu'
      ? fakeUrdu(surah, ayah)
      : fakeEnglish(surah, ayah);

/** A stand-in for api.alquran.cloud that serves invented text. */
export function createFakeQuranApi(): FakeQuranApi {
  const api: FakeQuranApi = {
    calls: [],
    offline: false,
    garbage: false,
    withoutTranslation: false,
    english: 'full',
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

      const surahMatch = /\/surah\/(\d+)\/editions\/([^/]+)$/.exec(url);
      if (surahMatch) {
        const surah = Number(surahMatch[1]);
        const count = ayahCountOf(surah);
        if (count === 0) return Promise.resolve(new Response('{}', { status: 404 }));
        const data: unknown[] = [];
        for (const id of (surahMatch[2] ?? '').split(',')) {
          const edition = editionOf(id);
          if (edition === null) return Promise.resolve(new Response('{}', { status: 404 }));
          if (edition === 'english' && api.english === 'missing') continue;
          if (edition === 'english' && api.english === 'unreadable') {
            data.push({ nope: 1 });
            continue;
          }
          const empty =
            (edition !== 'arabic' && api.withoutTranslation) ||
            (edition === 'english' && api.english === 'empty');
          data.push({
            ayahs: empty
              ? []
              : Array.from({ length: count }, (_, i) =>
                  ayahOf(surah, i + 1, textOf(edition, surah, i + 1), false),
                ),
          });
        }
        return Promise.resolve(json({ status: 'OK', data }));
      }

      // The mushaf page endpoints, with an invented layout: page N holds the first (up to 8) ayahs
      // of surah N, and every ayah of surah N is "on" page N.
      const pageMatch = /\/page\/(\d+)\/quran-uthmani$/.exec(url);
      if (pageMatch) {
        const page = Number(pageMatch[1]);
        const surah = Math.min(page, 114);
        const count = Math.min(8, ayahCountOf(surah));
        const ayahs = Array.from({ length: count }, (_, i) => ({
          ...ayahOf(surah, i + 1, fakeArabic(surah, i + 1), true),
          juz: 1,
        }));
        return Promise.resolve(json({ status: 'OK', data: { number: page, ayahs } }));
      }
      const pageOfMatch = /\/ayah\/(\d+):(\d+)\/quran-uthmani$/.exec(url);
      if (pageOfMatch) {
        const surah = Number(pageOfMatch[1]);
        const ayah = Number(pageOfMatch[2]);
        if (ayah < 1 || ayah > ayahCountOf(surah)) {
          return Promise.resolve(new Response('{}', { status: 404 }));
        }
        return Promise.resolve(json({ status: 'OK', data: { page: surah } }));
      }

      const ayahMatch = /\/ayah\/(\d+):(\d+)\/editions\/([^/]+)$/.exec(url);
      if (ayahMatch) {
        const surah = Number(ayahMatch[1]);
        const ayah = Number(ayahMatch[2]);
        if (ayah < 1 || ayah > ayahCountOf(surah)) {
          return Promise.resolve(new Response('{}', { status: 404 }));
        }
        const data: unknown[] = [];
        for (const id of (ayahMatch[3] ?? '').split(',')) {
          const edition = editionOf(id);
          if (edition === null) return Promise.resolve(new Response('{}', { status: 404 }));
          if (edition === 'english' && api.english === 'missing') continue;
          if (edition === 'english' && api.english === 'unreadable') {
            data.push({ nope: 1 });
            continue;
          }
          const empty =
            (edition !== 'arabic' && api.withoutTranslation) ||
            (edition === 'english' && api.english === 'empty');
          data.push(ayahOf(surah, ayah, empty ? '' : textOf(edition, surah, ayah), true));
        }
        return Promise.resolve(json({ status: 'OK', data }));
      }

      const juzMatch = /\/juz\/(\d+)\/(.+)$/.exec(url);
      if (juzMatch) {
        const juz = Number(juzMatch[1]);
        const edition = editionOf(juzMatch[2] ?? '');
        if (edition === null) return Promise.resolve(new Response('{}', { status: 404 }));
        if (edition === 'english' && api.english === 'missing') {
          return Promise.resolve(new Response('{}', { status: 404 }));
        }
        if (edition === 'english' && api.english === 'unreadable') {
          return Promise.resolve(json({ status: 'OK', data: { nope: 1 } }));
        }
        const empty =
          (edition !== 'arabic' && api.withoutTranslation) ||
          (edition === 'english' && api.english === 'empty');
        const ayahs = empty
          ? []
          : juzSegments(juz).flatMap((seg) =>
              Array.from({ length: seg.toAyah - seg.fromAyah + 1 }, (_, i) => {
                const ayah = seg.fromAyah + i;
                return ayahOf(seg.surah, ayah, textOf(edition, seg.surah, ayah), true);
              }),
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
