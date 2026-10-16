import { useCallback, useMemo } from 'react';
import { messages, type MessageKey } from '@qc/i18n';
import { formatNumber, useTheme } from '@qc/ui';

/** The keys this package owns. */
export type ContentKey = Extract<
  MessageKey,
  `quran.${string}` | `prayer.${string}` | `home.reading.${string}` | 'tabs.quranPrayer'
>;

type Params = Record<string, string | number>;

export type Translate = (key: ContentKey, params?: Params) => string;
export type TranslatePlural = (base: PluralBase, count: number, params?: Params) => string;

/** Keys that have a `.one` and a `.other` form. */
export type PluralBase = ContentKey extends infer K
  ? K extends `${infer B}.one`
    ? B
    : never
  : never;

export function translate(locale: 'en' | 'ur', key: ContentKey, params?: Params): string {
  const table = messages[locale] as Record<string, string>;
  const fallback = messages.en as Record<string, string>;
  const template = table[key] ?? fallback[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = params[name];
    return value === undefined ? whole : String(value);
  });
}

/** English and Urdu both use "one" for exactly 1 and "other" for everything else. */
export function pluralKey(base: PluralBase, count: number): ContentKey {
  return `${base}.${count === 1 ? 'one' : 'other'}` as ContentKey;
}

export interface ContentI18n {
  locale: 'en' | 'ur';
  t: Translate;
  tn: TranslatePlural;
  /** Digits for the language (Western in both today). */
  n: (value: number | string) => string;
}

/** Strings for the current language of the theme. Every user-facing word goes through this. */
export function useContentI18n(): ContentI18n {
  const { locale } = useTheme();
  const t = useCallback<Translate>((key, params) => translate(locale, key, params), [locale]);
  const tn = useCallback<TranslatePlural>(
    (base, count, params) =>
      translate(locale, pluralKey(base, count), { count: formatNumber(count, locale), ...params }),
    [locale],
  );
  const n = useCallback((value: number | string) => formatNumber(value, locale), [locale]);
  return useMemo(() => ({ locale, t, tn, n }), [locale, t, tn, n]);
}
