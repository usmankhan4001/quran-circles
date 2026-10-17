import { z } from 'zod';
import { isValidAyah } from '../meta/ayah';
import { isJuzNumber } from '../meta/juz';
import { isSurahNumber } from '../meta/surahs';
import {
  isAbortError,
  QuranSourceError,
  type FetchOptions,
  type QuranAyah,
  type QuranPassage,
  type QuranSource,
  type QuranVerse,
} from './types';

/**
 * The online source V1 used. The Arabic and Urdu edition ids are the ones V1 asked for; the
 * English one (Maududi's English translation) was added for English screens (owner decision,
 * 2026-10-17).
 */
export const ALQURAN_CLOUD_BASE_URL = 'https://api.alquran.cloud/v1';
export const DEFAULT_EDITIONS = {
  arabic: 'quran-uthmani',
  urdu: 'ur.maududi',
  english: 'en.maududi',
} as const;

export interface QuranEditions {
  arabic: string;
  urdu: string;
  /** The English translation. Leave out, or pass null, to ask for none. */
  english?: string | null;
}

export interface AlQuranCloudOptions {
  fetch: typeof fetch;
  baseUrl?: string;
  editions?: QuranEditions;
  now?: () => Date;
}

const AyahSchema = z.object({
  number: z.number().int(),
  numberInSurah: z.number().int(),
  text: z.string(),
  surah: z.object({ number: z.number().int() }).optional(),
});
const EditionSchema = z.object({ ayahs: z.array(AyahSchema) });
const Envelope = z.object({ status: z.string(), data: z.unknown() });
/**
 * `/surah/{n}/editions/...` and `/ayah/{surah}:{ayah}/editions/...` answer with one entry per
 * edition, in the asked order. The Arabic and the Urdu have to be there; the English is read on
 * its own, so a missing or unreadable English edition only means "no English translation".
 */
const EditionsData = z.array(z.unknown()).min(2);

type Ayah = z.infer<typeof AyahSchema>;
type Edition = z.infer<typeof EditionSchema>;

/** The English edition when it can be read, else undefined (never an error). */
function optionalEdition(value: unknown): Edition | undefined {
  const parsed = EditionSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

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

const translationsOf = (edition: Edition | undefined) =>
  new Map((edition?.ayahs ?? []).map((a) => [a.number, a.text]));

/**
 * Joins the translations to the Arabic by the source's running ayah number, not by position,
 * so a gap in one edition cannot shift every translation below it. An empty text counts as no
 * translation.
 */
function join(
  arabic: Edition,
  urdu: Edition,
  english: Edition | undefined,
  surahOf: (ayah: Ayah) => number,
): QuranVerse[] {
  const urduOf = translationsOf(urdu);
  const englishOf = translationsOf(english);
  return arabic.ayahs.map((a) => ({
    surah: surahOf(a),
    ayah: a.numberInSurah,
    arabic: a.text,
    urdu: urduOf.get(a.number)?.trim() || null,
    english: englishOf.get(a.number)?.trim() || null,
  }));
}

/**
 * Reads the Arabic and the Urdu and English translations from api.alquran.cloud, the source V1
 * used. A surah or a single ayah is one request for all editions, as before; a juz is one
 * request per edition (the source has no combined juz request that V1 could rely on).
 */
export function createAlQuranCloudSource(options: AlQuranCloudOptions): QuranSource {
  const baseUrl = (options.baseUrl ?? ALQURAN_CLOUD_BASE_URL).replace(/\/+$/, '');
  const editions = options.editions ?? DEFAULT_EDITIONS;
  const englishId = editions.english ?? null;
  const editionList = [editions.arabic, editions.urdu, ...(englishId ? [englishId] : [])].join(',');
  const now = options.now ?? (() => new Date());
  const passage = (kind: 'surah' | 'juz', id: number, verses: QuranVerse[]): QuranPassage => ({
    kind,
    id,
    verses,
    fromCache: false,
    stale: false,
    fetchedAt: now().toISOString(),
  });

  return {
    async getSurah(surah, fetchOptions) {
      if (!isSurahNumber(surah)) throw new QuranSourceError('not_found');
      const data = await getJson(
        options.fetch,
        `${baseUrl}/surah/${surah}/editions/${editionList}`,
        fetchOptions,
      );
      const parsed = EditionsData.safeParse(data);
      if (!parsed.success) throw new QuranSourceError('invalid_response');
      const arabic = EditionSchema.safeParse(parsed.data[0]);
      const urdu = EditionSchema.safeParse(parsed.data[1]);
      if (!arabic.success || !urdu.success || arabic.data.ayahs.length === 0) {
        throw new QuranSourceError('invalid_response');
      }
      const english = englishId ? optionalEdition(parsed.data[2]) : undefined;
      return passage(
        'surah',
        surah,
        join(arabic.data, urdu.data, english, () => surah),
      );
    },

    async getJuz(juz, fetchOptions) {
      if (!isJuzNumber(juz)) throw new QuranSourceError('not_found');
      // V1 found the combined editions endpoint unreliable for a juz, so ask for each one.
      // The English is optional: an edition the source does not have, or cannot send readably,
      // means "no English translation". A dropped connection or an error status still fails
      // the read, so the cache keeps (and later refreshes) its copy instead of an English-less one.
      const [arabicData, urduData, englishData] = await Promise.all([
        getJson(options.fetch, `${baseUrl}/juz/${juz}/${editions.arabic}`, fetchOptions),
        getJson(options.fetch, `${baseUrl}/juz/${juz}/${editions.urdu}`, fetchOptions),
        englishId
          ? getJson(options.fetch, `${baseUrl}/juz/${juz}/${englishId}`, fetchOptions).catch(
              (error: unknown) => {
                if (
                  error instanceof QuranSourceError &&
                  (error.code === 'not_found' || error.code === 'invalid_response')
                ) {
                  return undefined;
                }
                throw error;
              },
            )
          : undefined,
      ]);
      const arabic = EditionSchema.safeParse(arabicData);
      const urdu = EditionSchema.safeParse(urduData);
      if (!arabic.success || !urdu.success || arabic.data.ayahs.length === 0) {
        throw new QuranSourceError('invalid_response');
      }
      if (arabic.data.ayahs.some((a) => a.surah === undefined)) {
        throw new QuranSourceError('invalid_response');
      }
      return passage(
        'juz',
        juz,
        join(arabic.data, urdu.data, optionalEdition(englishData), (a) => a.surah?.number ?? 0),
      );
    },

    async getAyah(surah, ayah, fetchOptions): Promise<QuranAyah> {
      if (!isValidAyah(surah, ayah)) throw new QuranSourceError('not_found');
      const data = await getJson(
        options.fetch,
        `${baseUrl}/ayah/${surah}:${ayah}/editions/${editionList}`,
        fetchOptions,
      );
      const parsed = EditionsData.safeParse(data);
      if (!parsed.success) throw new QuranSourceError('invalid_response');
      const arabicParsed = AyahSchema.safeParse(parsed.data[0]);
      const urduParsed = AyahSchema.safeParse(parsed.data[1]);
      if (!arabicParsed.success || !urduParsed.success) {
        throw new QuranSourceError('invalid_response');
      }
      const arabic = arabicParsed.data;
      // The answer has to be the ayah that was asked for.
      const isAsked = (a: Ayah) =>
        a.numberInSurah === ayah && (a.surah === undefined || a.surah.number === surah);
      if (!isAsked(arabic) || !arabic.text.trim()) {
        throw new QuranSourceError('invalid_response');
      }
      // A translation counts only when it belongs to the same ayah as the Arabic.
      const translation = (a: Ayah | undefined) =>
        a !== undefined && isAsked(a) && a.number === arabic.number ? a.text.trim() || null : null;
      const englishParsed = englishId ? AyahSchema.safeParse(parsed.data[2]) : undefined;
      return {
        verse: {
          surah,
          ayah,
          arabic: arabic.text,
          urdu: translation(urduParsed.data),
          english: translation(englishParsed?.success ? englishParsed.data : undefined),
        },
        fromCache: false,
        stale: false,
        fetchedAt: now().toISOString(),
      };
    },
  };
}
