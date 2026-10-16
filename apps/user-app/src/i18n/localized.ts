import type { Locale, Localized } from '@qc/contracts';

export interface LocalizedText {
  text: string;
  /** The language the text is actually in, so `Text` can pick the right font and direction. */
  lang: Locale;
}

/** English is always present; Urdu is null until someone writes it, and then English shows. */
export function pickLocalized(value: Localized, locale: Locale): LocalizedText {
  if (locale === 'ur' && value.ur) return { text: value.ur, lang: 'ur' };
  return { text: value.en, lang: 'en' };
}
