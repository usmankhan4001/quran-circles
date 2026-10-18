import { useEffect, useState } from 'react';
import type { Locale } from '@qc/contracts';
import { languages } from './languages';
import { otherLocale, prefetchLanguage, type LanguageLoader } from './languageLoader';

/**
 * The language to draw the screens in. It is the saved one once its words are in; while they
 * are still downloading after a switch, the screens stay in the language they were in, so
 * nothing is ever drawn half in one language or with bare keys. The root layout loads the
 * saved language before the first screen, so at start the two are the same.
 */
export function useShownLocale(requested: Locale, loader: LanguageLoader = languages): Locale {
  const loaded = loader.isLoaded(requested);
  const [shown, setShown] = useState<Locale>(requested);
  useEffect(() => {
    if (loaded) {
      setShown(requested);
      return;
    }
    let active = true;
    loader.load(requested).then(
      () => {
        if (active) setShown(requested);
      },
      () => undefined,
    );
    return () => {
      active = false;
    };
  }, [requested, loaded, loader]);
  return loaded ? requested : shown;
}

/** How long after the tabs appear the web fetches the other language's words. */
export const OTHER_LANGUAGE_DELAY_MS = 20_000;

/**
 * Fetches the other language's words once the app has long settled, when the browser is idle,
 * so the service worker keeps both files and a switch works offline later. A phone has both
 * languages already, so nothing happens there.
 */
export function usePrefetchOtherLanguage(
  locale: Locale,
  { loader = languages, delayMs = OTHER_LANGUAGE_DELAY_MS } = {},
): void {
  useEffect(() => {
    const other = otherLocale(locale);
    if (loader.isLoaded(other)) return;
    let idle: number | null = null;
    const timer = setTimeout(() => {
      const start = () => prefetchLanguage(loader, other);
      if (typeof requestIdleCallback === 'function') idle = requestIdleCallback(start);
      else start();
    }, delayMs);
    return () => {
      clearTimeout(timer);
      if (idle !== null && typeof cancelIdleCallback === 'function') cancelIdleCallback(idle);
    };
  }, [locale, loader, delayMs]);
}
