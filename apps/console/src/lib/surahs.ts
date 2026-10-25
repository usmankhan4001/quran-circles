/**
 * Surah names for the console's Quran references ("Surah Ar-Ra'd (13), ayah 28" rather than
 * "Surah 13, ayah 28"). The names come read-only from the content lane's static list, which holds
 * names and ayah counts only, no Quran text. `@qc/content` is not a console dependency and its
 * main entry pulls in React Native screens, so this reads the one pure module by relative path,
 * as `lib/ui-tokens.ts` does for the ui tokens. A change request can ask for a web-safe
 * `@qc/content/meta` dependency; this file is then the only place to update.
 */
import { getSurah } from '../../../../packages/content/src/meta/surahs';
import { isolate } from './ui-tokens';

export type SurahLocale = 'en' | 'ur';

/**
 * The surah's name in the reader's language: the transliteration in English ("Ar-Ra'd"), the
 * Arabic name as printed in the mushaf in Urdu ("الرعد"). Undefined for a number that is not a
 * surah.
 */
export function surahName(surah: number, locale: SurahLocale): string | undefined {
  const info = getSurah(surah);
  if (!info) return undefined;
  return locale === 'ur' ? info.nameArabic : info.nameSimple;
}

/**
 * The name with its number, to fill `{surah}` in a message: "Ar-Ra'd (13)", or in Urdu the
 * Arabic name and the isolated number. A number that is not a surah is shown as the number only,
 * so a bad value is still visible rather than hidden.
 */
export function surahLabel(
  surah: number,
  locale: SurahLocale,
  formatNumber: (n: number) => string = String,
): string {
  const name = surahName(surah, locale);
  const num = formatNumber(surah);
  if (!name) return locale === 'ur' ? isolate(num) : num;
  return locale === 'ur' ? `${isolate(name)} (${isolate(num)})` : `${name} (${num})`;
}

/**
 * The number first and then the name, for a list in surah order: "2 · Al-Baqarah", or in Urdu
 * the isolated number and the Arabic name. A number that is not a surah is the number only.
 */
export function surahNumbered(
  surah: number,
  locale: SurahLocale,
  formatNumber: (n: number) => string = String,
): string {
  const name = surahName(surah, locale);
  const num = locale === 'ur' ? isolate(formatNumber(surah)) : formatNumber(surah);
  return name ? `${num} · ${name}` : num;
}
