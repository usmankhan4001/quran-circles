import { messages, type UserAppKey } from '@qc/i18n';
import { formatNumber } from '@qc/ui';
import type { Locale } from '@qc/contracts';

/**
 * The keys this app has words for: the catalogue's shared part and the app's own
 * (`@qc/i18n` `UserAppKey`). On the web only this app's table is downloaded, so a key from
 * another app's part would have no words; the typechecker refuses it.
 */
export type MessageKey = UserAppKey;
/** `home.sessions` is a plural key when `home.sessions.one` and `home.sessions.other` exist. */
type PluralBase<K extends string> = K extends `${infer B}.one` ? B : never;
export type PluralKey = PluralBase<MessageKey>;
export type TranslationKey = MessageKey | PluralKey;
export type TranslationParams = Record<string, string | number>;
export type TFunction = (key: TranslationKey, params?: TranslationParams) => string;

type Table = Record<string, string>;

const tables: Record<Locale, Table> = {
  en: messages.en as unknown as Table,
  ur: messages.ur as unknown as Table,
};

/**
 * English and Urdu both use two forms: exactly 1 is `one`, everything else is `other`. This is
 * written out rather than read from `Intl.PluralRules`, which Hermes (the phone engine) lacks.
 */
export function pluralForm(count: number): 'one' | 'other' {
  return count === 1 ? 'one' : 'other';
}

function lookup(locale: Locale, key: string): string | undefined {
  return tables[locale][key] ?? tables.en[key];
}

function fill(template: string, params: TranslationParams | undefined, locale: Locale): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = params[name];
    if (value === undefined) return whole;
    // Counts are the one number the translator formats, so every screen shows the same digits.
    if (name === 'count' && typeof value === 'number') return formatNumber(value, locale);
    return String(value);
  });
}

/**
 * Builds the translate function for one language. Missing Urdu falls back to English, and a
 * missing key shows the key, so a gap is visible rather than blank.
 */
export function createTranslator(locale: Locale): TFunction {
  return (key, params) => {
    const count = params?.count;
    if (typeof count === 'number') {
      const form = pluralForm(count);
      const plural = lookup(locale, `${key}.${form}`) ?? lookup(locale, `${key}.other`);
      if (plural !== undefined) return fill(plural, params, locale);
    }
    return fill(lookup(locale, key) ?? key, params, locale);
  };
}
