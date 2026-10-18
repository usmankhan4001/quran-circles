import { messages, type AdminAppKey } from '@qc/i18n';
import type { Locale } from '@qc/contracts';
import { formatNumber } from '@qc/ui';

/**
 * The keys this app has words for: the catalogue's shared part and the app's own
 * (`@qc/i18n` `AdminAppKey`). On the web only this app's table is downloaded, so a key from
 * another app's part would have no words; the typechecker refuses it.
 */
export type MessageKey = AdminAppKey;
export type Params = Record<string, string | number>;

/** Keys that have a `.one` and a `.other` form, named by their shared base. */
export type PluralBase = MessageKey extends infer K
  ? K extends `${infer B}.one`
    ? B
    : never
  : never;

function fill(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = params[name];
    return value === undefined ? whole : String(value);
  });
}

/** Looks a key up in the person's language, falling back to English, then to the key itself. */
export function translate(locale: Locale, key: MessageKey, params?: Params): string {
  const table = messages[locale] as Record<string, string>;
  const fallback = messages.en as Record<string, string>;
  return fill(table[key] ?? fallback[key] ?? key, params);
}

/**
 * Picks `<base>.one` or `<base>.other` by the language's plural rule. The count is formatted
 * here with the language's numerals and passed as `{count}`.
 */
export function translatePlural(
  locale: Locale,
  base: PluralBase,
  count: number,
  params?: Params,
): string {
  const form = new Intl.PluralRules(locale).select(count) === 'one' ? 'one' : 'other';
  return translate(locale, `${base}.${form}` as MessageKey, {
    ...params,
    count: formatNumber(count, locale),
  });
}

export type Translator = {
  (key: MessageKey, params?: Params): string;
  plural: (base: PluralBase, count: number, params?: Params) => string;
};

export function createTranslator(locale: Locale): Translator {
  const t = ((key: MessageKey, params?: Params) => translate(locale, key, params)) as Translator;
  t.plural = (base, count, params) => translatePlural(locale, base, count, params);
  return t;
}

/**
 * True when a key exists, so a caller can fall back to plain text for an unknown id. The web
 * holds only the languages loaded so far (`@qc/i18n/client`), so either one may answer.
 */
export function hasMessage(key: string): key is MessageKey {
  return (
    key in (messages.en as Record<string, string>) || key in (messages.ur as Record<string, string>)
  );
}
