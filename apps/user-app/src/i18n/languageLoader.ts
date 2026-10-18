import type { Locale } from '@qc/contracts';

export type MessageTable = Readonly<Record<string, string>>;
export type TableLoader = () => Promise<{ default: MessageTable }>;

/**
 * Which languages' words are on hand, and how to get the others. The web downloads one
 * language's table at a time (`languages.web.ts`); a phone has every language in its bundle
 * (`languages.ts`).
 */
export interface LanguageLoader {
  isLoaded: (locale: Locale) => boolean;
  /** Resolves once the language's words are in; rejects when they cannot be had (offline). */
  load: (locale: Locale) => Promise<void>;
}

/** Every language is in the bundle: phones, and tests, which import the full catalogue. */
export const bundledLanguages: LanguageLoader = {
  isLoaded: () => true,
  load: () => Promise.resolve(),
};

export function otherLocale(locale: Locale): Locale {
  return locale === 'ur' ? 'en' : 'ur';
}

/**
 * Loads each language's table at most once at a time, and installs it. A failed download is
 * forgotten, so the next call tries again (the service worker answers from its cache offline).
 */
export function createLanguageLoader(options: {
  tables: Record<Locale, TableLoader>;
  install: (locale: Locale, table: MessageTable) => void;
  has: (locale: Locale) => boolean;
}): LanguageLoader {
  const pending = new Map<Locale, Promise<void>>();
  return {
    isLoaded: options.has,
    load(locale) {
      if (options.has(locale)) return Promise.resolve();
      let loading = pending.get(locale);
      if (!loading) {
        // A loader can throw before it returns a promise (the bundle loader missing, say): that
        // is a failed download like any other, never an exception out of `load`.
        let started: Promise<{ default: MessageTable }>;
        try {
          started = options.tables[locale]();
        } catch (error) {
          started = Promise.reject(error instanceof Error ? error : new Error(String(error)));
        }
        loading = started.then(
          (module) => {
            options.install(locale, module.default);
            pending.delete(locale);
          },
          (error: unknown) => {
            pending.delete(locale);
            throw error;
          },
        );
        pending.set(locale, loading);
      }
      return loading;
    },
  };
}

/** Starts a load and ignores the outcome: a later `load` tries again if this one failed. */
export function prefetchLanguage(loader: LanguageLoader, locale: Locale): void {
  loader.load(locale).catch(() => undefined);
}
