import { z } from 'zod';
import { isValidAyah } from '../meta/ayah';
import { readJson, writeJson } from '../storage/json';
import type { KeyValueStorage } from '../storage/types';
import { ALQURAN_CLOUD_BASE_URL, DEFAULT_EDITIONS } from './alquranCloud';
import { isAbortError, QuranSourceError, type FetchOptions } from './types';

/** The Madani mushaf has 604 pages. */
export const MUSHAF_PAGE_COUNT = 604;

export function isMushafPage(page: number): boolean {
  return Number.isInteger(page) && page >= 1 && page <= MUSHAF_PAGE_COUNT;
}

/** One ayah of a mushaf page, with the surah it belongs to (a page can hold the end of one surah and the start of the next). */
export interface MushafAyah {
  surah: number;
  ayah: number;
  arabic: string;
}

export interface MushafPage {
  page: number;
  ayahs: MushafAyah[];
  /** The juz the page starts in. */
  juz: number | null;
  fromCache: boolean;
  fetchedAt: string;
}

export interface MushafPageSource {
  getPage(page: number, options?: FetchOptions): Promise<MushafPage>;
  /** The page an ayah is printed on. */
  pageOf(surah: number, ayah: number, options?: FetchOptions): Promise<number>;
}

export interface MushafPageSourceOptions {
  fetch: typeof fetch;
  storage: KeyValueStorage;
  baseUrl?: string;
  now?: () => Date;
  /** Keep pages on the device. False reads online only (decision 0008). Default true. */
  cache?: boolean;
}

const PageAyah = z.object({
  numberInSurah: z.number().int(),
  text: z.string(),
  juz: z.number().int().optional(),
  surah: z.object({ number: z.number().int() }),
});
const PageData = z.object({ number: z.number().int(), ayahs: z.array(PageAyah).min(1) });
const AyahData = z.object({ page: z.number().int() });
const Envelope = z.object({ status: z.string(), data: z.unknown() });
const Stored = z.object({
  fetchedAt: z.string(),
  juz: z.number().int().nullable(),
  ayahs: z.array(z.object({ surah: z.number().int(), ayah: z.number().int(), arabic: z.string() })),
});

const KEY_PREFIX = 'qc.quran.page.v1:';

async function getJson(
  doFetch: typeof fetch,
  url: string,
  options: FetchOptions | undefined,
): Promise<unknown> {
  let response: Response;
  try {
    response = await doFetch(url, { signal: options?.signal });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new QuranSourceError('offline');
  }
  if (response.status === 404) throw new QuranSourceError('not_found');
  if (!response.ok) throw new QuranSourceError('unavailable', `status ${response.status}`);
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new QuranSourceError('invalid_response');
  }
  const envelope = Envelope.safeParse(body);
  if (!envelope.success || envelope.data.status !== 'OK') {
    throw new QuranSourceError('invalid_response');
  }
  return envelope.data.data;
}

/**
 * Reads whole mushaf pages (Arabic only) from the same online source as the reader. A page is
 * kept on the device once read, because the text of a page does not change; it is read from there
 * first, so a page seen once opens offline.
 */
export function createMushafPageSource(options: MushafPageSourceOptions): MushafPageSource {
  const baseUrl = (options.baseUrl ?? ALQURAN_CLOUD_BASE_URL).replace(/\/+$/, '');
  const now = options.now ?? (() => new Date());
  const keep = options.cache ?? true;
  const pages = new Map<string, number>();

  return {
    async getPage(page, fetchOptions) {
      if (!isMushafPage(page)) throw new QuranSourceError('not_found');
      const key = `${KEY_PREFIX}${page}`;
      if (keep) {
        const saved = await readJson(options.storage, key, Stored);
        if (saved && saved.ayahs.length > 0) {
          return {
            page,
            ayahs: saved.ayahs,
            juz: saved.juz,
            fromCache: true,
            fetchedAt: saved.fetchedAt,
          };
        }
      }
      const data = await getJson(
        options.fetch,
        `${baseUrl}/page/${page}/${DEFAULT_EDITIONS.arabic}`,
        fetchOptions,
      );
      const parsed = PageData.safeParse(data);
      if (!parsed.success || parsed.data.number !== page) {
        throw new QuranSourceError('invalid_response');
      }
      const ayahs = parsed.data.ayahs.map((a) => ({
        surah: a.surah.number,
        ayah: a.numberInSurah,
        arabic: a.text,
      }));
      const juz = parsed.data.ayahs[0]?.juz ?? null;
      const fetchedAt = now().toISOString();
      if (keep) await writeJson(options.storage, key, { fetchedAt, juz, ayahs });
      return { page, ayahs, juz, fromCache: false, fetchedAt };
    },

    async pageOf(surah, ayah, fetchOptions) {
      if (!isValidAyah(surah, ayah)) throw new QuranSourceError('not_found');
      const ref = `${surah}:${ayah}`;
      const known = pages.get(ref);
      if (known !== undefined) return known;
      const data = await getJson(
        options.fetch,
        `${baseUrl}/ayah/${ref}/${DEFAULT_EDITIONS.arabic}`,
        fetchOptions,
      );
      const parsed = AyahData.safeParse(data);
      if (!parsed.success || !isMushafPage(parsed.data.page)) {
        throw new QuranSourceError('invalid_response');
      }
      pages.set(ref, parsed.data.page);
      return parsed.data.page;
    },
  };
}
