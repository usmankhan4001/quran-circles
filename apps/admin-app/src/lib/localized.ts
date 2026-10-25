import type { Localized, Locale } from '@qc/contracts';

/**
 * The text in the person's language, falling back to English, as the contract promises. Use it
 * for every venue, area, city and circle name: Urdu readers see the Urdu name wherever one was
 * written. Blank Urdu counts as none.
 */
export function pickLocalized(value: Localized | null | undefined, locale: Locale): string {
  if (!value) return '';
  return locale === 'ur' && value.ur?.trim() ? value.ur : value.en;
}

/**
 * What a search box matches a name against: both languages, so a coordinator reading in Urdu
 * still finds a venue by the English name they know, and the other way round.
 */
export function localizedSearchText(value: Localized | null | undefined): string {
  if (!value) return '';
  return value.ur?.trim() ? `${value.en}\n${value.ur}` : value.en;
}

export interface ShownText {
  text: string;
  /** The language the text is in, for the font and the direction. */
  lang: Locale;
}

/**
 * Text being typed in both languages, as a preview shows it: the person's language first
 * (falling back to the other one), and the other language second when it has its own text.
 * Null when both are empty.
 */
export function shownBilingual(
  v: BilingualFields,
  locale: Locale,
): { main: ShownText; second: ShownText | null } | null {
  const own = (locale === 'ur' ? v.ur : v.en).trim();
  const otherLocale: Locale = locale === 'ur' ? 'en' : 'ur';
  const other = (locale === 'ur' ? v.en : v.ur).trim();
  if (!own && !other) return null;
  if (!own) return { main: { text: other, lang: otherLocale }, second: null };
  return {
    main: { text: own, lang: locale },
    second: other && other !== own ? { text: other, lang: otherLocale } : null,
  };
}

export interface BilingualFields {
  en: string;
  ur: string;
}

export const emptyBilingual = (): BilingualFields => ({ en: '', ur: '' });

export const bilingualOf = (value: Localized | null | undefined): BilingualFields => ({
  en: value?.en ?? '',
  ur: value?.ur ?? '',
});

/** True when neither language has any text. */
export const isBilingualEmpty = (v: BilingualFields): boolean => !v.en.trim() && !v.ur.trim();

/**
 * The contract needs English text. A coordinator who writes only in Urdu should not have to
 * type it twice, so Urdu stands in for the English text when English is empty: clients fall
 * back to English anyway, and the Urdu reader sees the Urdu.
 */
export function toLocalizedInput(v: BilingualFields): { en: string; ur: string | null } | null {
  const en = v.en.trim();
  const ur = v.ur.trim();
  if (!en && !ur) return null;
  return { en: en || ur, ur: ur || null };
}

/** The same, for fields where the contract wants `ur` left out when empty. */
export function toLocalizedOptional(v: BilingualFields): { en: string; ur?: string } | null {
  const out = toLocalizedInput(v);
  if (!out) return null;
  return out.ur ? { en: out.en, ur: out.ur } : { en: out.en };
}
