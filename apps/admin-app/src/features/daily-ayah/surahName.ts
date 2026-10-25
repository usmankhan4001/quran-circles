import type { Locale } from '@qc/contracts';
import { getSurah } from '@qc/content/meta';

/**
 * The name of a surah inside a sentence, as the user app writes it: English shows the
 * transliteration ("Ar-Ra'd"); Urdu shows the Arabic-script name ("الرعد"), which is how Urdu
 * readers know the surahs. Null for a number that is not a surah.
 */
export function surahName(surah: number, locale: Locale): string | null {
  const info = Number.isInteger(surah) ? getSurah(surah) : undefined;
  if (!info) return null;
  return locale === 'ur' ? info.nameArabic : info.nameSimple;
}
