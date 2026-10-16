import { z } from 'zod';
import { isJuzNumber } from '../meta/juz';
import { isSurahNumber } from '../meta/surahs';
import {
  isAbortError,
  QuranSourceError,
  type FetchOptions,
  type QuranPassage,
  type QuranSource,
  type QuranVerse,
} from './types';

/** The online source V1 used. Its edition ids are the same ones V1 asked for. */
export const ALQURAN_CLOUD_BASE_URL = 'https://api.alquran.cloud/v1';
export const DEFAULT_EDITIONS = { arabic: 'quran-uthmani', urdu: 'ur.maududi' } as const;

export interface AlQuranCloudOptions {
  fetch: typeof fetch;
  baseUrl?: string;
  editions?: { arabic: string; urdu: string };
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
const SurahEditionsData = z.array(EditionSchema).min(2);

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
 * Joins the translation to the Arabic by the source's running ayah number, not by position,
 * so a gap in one edition cannot shift every translation below it.
 */
function join(
  arabic: z.infer<typeof EditionSchema>,
  urdu: z.infer<typeof EditionSchema>,
  surahOf: (ayah: z.infer<typeof AyahSchema>) => number,
): QuranVerse[] {
  const translation = new Map(urdu.ayahs.map((a) => [a.number, a.text]));
  return arabic.ayahs.map((a) => ({
    surah: surahOf(a),
    ayah: a.numberInSurah,
    arabic: a.text,
    urdu: translation.get(a.number)?.trim() || null,
  }));
}

/** Reads Arabic and Urdu from api.alquran.cloud, the source V1 used. */
export function createAlQuranCloudSource(options: AlQuranCloudOptions): QuranSource {
  const baseUrl = (options.baseUrl ?? ALQURAN_CLOUD_BASE_URL).replace(/\/+$/, '');
  const editions = options.editions ?? DEFAULT_EDITIONS;
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
        `${baseUrl}/surah/${surah}/editions/${editions.arabic},${editions.urdu}`,
        fetchOptions,
      );
      const parsed = SurahEditionsData.safeParse(data);
      if (!parsed.success) throw new QuranSourceError('invalid_response');
      const [arabic, urdu] = parsed.data;
      if (!arabic || !urdu || arabic.ayahs.length === 0) {
        throw new QuranSourceError('invalid_response');
      }
      return passage(
        'surah',
        surah,
        join(arabic, urdu, () => surah),
      );
    },

    async getJuz(juz, fetchOptions) {
      if (!isJuzNumber(juz)) throw new QuranSourceError('not_found');
      // V1 found the combined editions endpoint unreliable for a juz, so ask for each one.
      const [arabicData, urduData] = await Promise.all([
        getJson(options.fetch, `${baseUrl}/juz/${juz}/${editions.arabic}`, fetchOptions),
        getJson(options.fetch, `${baseUrl}/juz/${juz}/${editions.urdu}`, fetchOptions),
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
        join(arabic.data, urdu.data, (a) => a.surah?.number ?? 0),
      );
    },
  };
}
