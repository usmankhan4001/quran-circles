import type { Localized, Locale } from '@qc/contracts';

/** The text in the person's language, falling back to English, as the contract promises. */
export function pickLocalized(value: Localized | null | undefined, locale: Locale): string {
  if (!value) return '';
  return locale === 'ur' ? (value.ur ?? value.en) : value.en;
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
