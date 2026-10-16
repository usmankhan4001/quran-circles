import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { messages, type MessageKey } from '@qc/i18n';
import { directionForLocale, type Direction } from '../lib/ui-tokens';
import { webStore, type KeyValueStore } from '../lib/storage';

export type Locale = 'en' | 'ur';
export type Params = Record<string, string | number>;

const LOCALE_KEY = 'qc.console.locale';

type Table = Record<string, string>;

/** Fills `{name}` placeholders. Numbers and dates arrive already formatted for the locale. */
export function translate(locale: Locale, key: string, params?: Params): string {
  const table = messages[locale] as Table;
  const fallback = messages.en as Table;
  const template = table[key] ?? fallback[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = params[name];
    return value === undefined ? whole : String(value);
  });
}

/** `<key>.one` and `<key>.other` by the locale's plural rule. The caller passes `count`. */
export function translatePlural(
  locale: Locale,
  baseKey: string,
  count: number,
  params?: Params,
): string {
  const form = new Intl.PluralRules(locale).select(count) === 'one' ? 'one' : 'other';
  return translate(locale, `${baseKey}.${form}`, { count, ...params });
}

const dateLocale = (locale: Locale) => (locale === 'ur' ? 'ur-PK-u-nu-latn' : 'en-GB');

export interface I18n {
  locale: Locale;
  dir: Direction;
  setLocale(locale: Locale): void;
  t(key: MessageKey, params?: Params): string;
  /** For keys built at run time, such as `errors.${code}`. Unknown keys return the key itself. */
  tx(key: string, params?: Params): string;
  tp(baseKey: string, count: number, params?: Params): string;
  number(value: number): string;
  dateTime(iso: string): string;
  date(iso: string): string;
  weekday(day: number, style?: 'short' | 'long'): string;
  /** English first, then Urdu: the name to show for `{ en, ur }` content in the current locale. */
  localized(value: { en: string; ur: string | null } | null | undefined): string;
}

const TIME_ZONE = 'Asia/Karachi';

export function createI18n(locale: Locale, setLocale: (l: Locale) => void): I18n {
  const dtf = new Intl.DateTimeFormat(dateLocale(locale), {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: TIME_ZONE,
  });
  const df = new Intl.DateTimeFormat(dateLocale(locale), {
    dateStyle: 'medium',
    timeZone: TIME_ZONE,
  });
  const nf = new Intl.NumberFormat(dateLocale(locale));
  return {
    locale,
    dir: directionForLocale(locale),
    setLocale,
    t: (key, params) => translate(locale, key, params),
    tx: (key, params) => translate(locale, key, params),
    tp: (baseKey, count, params) =>
      translatePlural(locale, baseKey, count, { count: nf.format(count), ...params }),
    number: (value) => nf.format(value),
    dateTime: (iso) => {
      const d = new Date(iso);
      return Number.isNaN(d.getTime()) ? iso : dtf.format(d);
    },
    date: (iso) => {
      const d = new Date(iso);
      return Number.isNaN(d.getTime()) ? iso : df.format(d);
    },
    weekday: (day, style = 'short') =>
      new Intl.DateTimeFormat(dateLocale(locale), { weekday: style, timeZone: 'UTC' }).format(
        // 2023-01-01 was a Sunday, so day 0 is Sunday.
        new Date(Date.UTC(2023, 0, 1 + day)),
      ),
    localized: (value) => (value ? (locale === 'ur' ? (value.ur ?? value.en) : value.en) : ''),
  };
}

const I18nContext = createContext<I18n | null>(null);

export interface I18nProviderProps {
  children: ReactNode;
  initialLocale?: Locale;
  store?: KeyValueStore;
}

export function I18nProvider({ children, initialLocale, store }: I18nProviderProps) {
  const kv = useMemo(() => store ?? webStore('local'), [store]);
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (initialLocale) return initialLocale;
    const saved = kv.get(LOCALE_KEY);
    return saved === 'ur' || saved === 'en' ? saved : 'en';
  });
  const setLocale = useCallback(
    (next: Locale) => {
      setLocaleState(next);
      kv.set(LOCALE_KEY, next);
    },
    [kv],
  );
  const value = useMemo(() => createI18n(locale, setLocale), [locale, setLocale]);

  // The document carries the language and direction, so the browser mirrors scrollbars,
  // form controls and text selection too.
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = value.dir;
    document.title = value.t('console.shell.appTitle');
  }, [locale, value]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}
