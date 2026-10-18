import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Locale } from '@qc/contracts';
import { parts } from '@qc/i18n';
import * as client from '@qc/i18n/client';
import {
  bundledLanguages,
  createLanguageLoader,
  otherLocale,
  prefetchLanguage,
  type LanguageLoader,
  type MessageTable,
} from './languageLoader';
import { languages as webLanguages } from './languages.web';
import { languages as phoneLanguages } from './languages';
import { useShownLocale, usePrefetchOtherLanguage } from './useLanguage';

/** A loader whose downloads the test finishes or fails by hand. */
function manualLoader() {
  const installed = new Set<Locale>(['en']);
  const calls: Locale[] = [];
  const waiting: Record<string, { resolve: () => void; reject: (e: Error) => void }> = {};
  const table = (locale: Locale) => () => {
    calls.push(locale);
    return new Promise<{ default: MessageTable }>((resolve, reject) => {
      waiting[locale] = { resolve: () => resolve({ default: { 'ui.close': locale } }), reject };
    });
  };
  const loader = createLanguageLoader({
    tables: { en: table('en'), ur: table('ur') },
    install: (locale) => installed.add(locale),
    has: (locale) => installed.has(locale),
  });
  return { loader, calls, waiting, installed };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('language loader', () => {
  it('downloads a language once, even when asked twice while it loads', async () => {
    const { loader, calls, waiting } = manualLoader();
    const first = loader.load('ur');
    const second = loader.load('ur');
    expect(calls).toEqual(['ur']);
    expect(loader.isLoaded('ur')).toBe(false);
    waiting.ur?.resolve();
    await Promise.all([first, second]);
    expect(loader.isLoaded('ur')).toBe(true);
    await loader.load('ur');
    expect(calls).toEqual(['ur']);
  });

  it('does not download a language that is already in', async () => {
    const { loader, calls } = manualLoader();
    await loader.load('en');
    expect(calls).toEqual([]);
  });

  it('forgets a failed download, so the next try asks again', async () => {
    const { loader, calls, waiting } = manualLoader();
    const failed = loader.load('ur');
    waiting.ur?.reject(new Error('offline'));
    await expect(failed).rejects.toThrow('offline');
    expect(loader.isLoaded('ur')).toBe(false);
    const retry = loader.load('ur');
    expect(calls).toEqual(['ur', 'ur']);
    waiting.ur?.resolve();
    await retry;
    expect(loader.isLoaded('ur')).toBe(true);
  });

  it('turns a loader that throws before it starts into a failed download, and tries again', async () => {
    const installed = new Set<Locale>(['en']);
    let attempts = 0;
    const loader = createLanguageLoader({
      tables: {
        en: () => Promise.resolve({ default: {} }),
        ur: () => {
          attempts += 1;
          if (attempts === 1) throw new Error('Requiring unknown module');
          return Promise.resolve({ default: { 'ui.close': 'ur' } });
        },
      },
      install: (locale) => installed.add(locale),
      has: (locale) => installed.has(locale),
    });
    expect(() => prefetchLanguage(loader, 'ur')).not.toThrow();
    await expect(loader.load('ur')).rejects.toThrow('Requiring unknown module');
    expect(loader.isLoaded('ur')).toBe(false);
    await expect(loader.load('ur')).resolves.toBeUndefined();
    expect(attempts).toBe(2);
    expect(loader.isLoaded('ur')).toBe(true);
  });

  it('ignores the outcome of a prefetch', async () => {
    const { loader, waiting } = manualLoader();
    prefetchLanguage(loader, 'ur');
    waiting.ur?.reject(new Error('offline'));
    await Promise.resolve();
    expect(loader.isLoaded('ur')).toBe(false);
  });

  it('names the other language', () => {
    expect(otherLocale('en')).toBe('ur');
    expect(otherLocale('ur')).toBe('en');
  });

  it('has every language at once on a phone', async () => {
    expect(phoneLanguages).toBe(bundledLanguages);
    expect(phoneLanguages.isLoaded('ur')).toBe(true);
    await expect(phoneLanguages.load('ur')).resolves.toBeUndefined();
  });
});

describe('the web catalogue', () => {
  it("downloads this app's words, one language at a time, into the live catalogue", async () => {
    const en = client.messages.en as Record<string, string>;
    const ur = client.messages.ur as Record<string, string>;
    expect(webLanguages.isLoaded('ur')).toBe(false);
    expect(ur['home.nextSession.title']).toBeUndefined();

    await webLanguages.load('ur');
    expect(webLanguages.isLoaded('ur')).toBe(true);
    expect(webLanguages.isLoaded('en')).toBe(false);
    expect(ur['home.nextSession.title']).toBe(parts['user-app'].ur['home.nextSession.title']);
    expect(ur['ui.close']).toBe(parts.shared.ur['ui.close']);
    // Only this app's part: the coordinator app's and the console's words stay out.
    expect(Object.keys(ur).some((k) => k.startsWith('admin.') || k.startsWith('console.'))).toBe(
      false,
    );
    expect(en['ui.close']).toBeUndefined();

    await webLanguages.load('en');
    expect(en['ui.close']).toBe('Close');
  });
});

describe('useShownLocale', () => {
  it('shows the saved language when its words are in', () => {
    const { loader } = manualLoader();
    const view = renderHook(({ locale }) => useShownLocale(locale, loader), {
      initialProps: { locale: 'en' as Locale },
    });
    expect(view.result.current).toBe('en');
  });

  it('keeps the screens in the old language until the new one has downloaded', async () => {
    const { loader, waiting } = manualLoader();
    const view = renderHook(({ locale }) => useShownLocale(locale, loader), {
      initialProps: { locale: 'en' as Locale },
    });
    view.rerender({ locale: 'ur' });
    expect(view.result.current).toBe('en');
    await act(async () => {
      waiting.ur?.resolve();
      await Promise.resolve();
    });
    await waitFor(() => expect(view.result.current).toBe('ur'));
    view.rerender({ locale: 'en' });
    expect(view.result.current).toBe('en');
  });

  it('stays in the language on screen when the new one cannot be had', async () => {
    const { loader, waiting } = manualLoader();
    const view = renderHook(({ locale }) => useShownLocale(locale, loader), {
      initialProps: { locale: 'en' as Locale },
    });
    view.rerender({ locale: 'ur' });
    await act(async () => {
      waiting.ur?.reject(new Error('offline'));
      await Promise.resolve();
    });
    expect(view.result.current).toBe('en');
  });
});

describe('usePrefetchOtherLanguage', () => {
  it('fetches the other language once the app has settled', () => {
    vi.useFakeTimers();
    const { loader, calls } = manualLoader();
    renderHook(() => usePrefetchOtherLanguage('en', { loader, delayMs: 1000 }));
    vi.advanceTimersByTime(999);
    expect(calls).toEqual([]);
    vi.advanceTimersByTime(1);
    vi.runAllTimers();
    expect(calls).toEqual(['ur']);
  });

  it('does nothing when the other language is already in, or the screen goes first', () => {
    vi.useFakeTimers();
    const loaded: LanguageLoader = { isLoaded: () => true, load: vi.fn(() => Promise.resolve()) };
    renderHook(() => usePrefetchOtherLanguage('ur', { loader: loaded, delayMs: 10 }));
    vi.runAllTimers();
    expect(loaded.load).not.toHaveBeenCalled();

    const { loader, calls } = manualLoader();
    const view = renderHook(() => usePrefetchOtherLanguage('en', { loader, delayMs: 10 }));
    view.unmount();
    vi.runAllTimers();
    expect(calls).toEqual([]);
  });
});
