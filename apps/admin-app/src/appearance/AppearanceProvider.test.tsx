import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Pressable, Text } from 'react-native';
import type { Locale } from '@qc/contracts';
import { createLanguageLoader } from '../i18n/languageLoader';
import { createMemoryStore, type KeyValueStore } from '../storage/storage';
import { APPEARANCE_KEY, AppearanceProvider, useAppearance } from './AppearanceProvider';

function Probe() {
  const { locale, ready, setLocale } = useAppearance();
  return (
    <Pressable
      testID="switch"
      onPress={() => void setLocale(locale === 'ur' ? 'en' : 'ur').catch(() => undefined)}
    >
      <Text testID="state">{`${locale}:${String(ready)}`}</Text>
    </Pressable>
  );
}

/** A store whose read waits until the test lets it finish. */
function slowStore(saved: string | null): { store: KeyValueStore; finish: () => void } {
  let finish = () => undefined as void;
  const read = new Promise<string | null>((resolve) => {
    finish = () => resolve(saved);
  });
  const store = createMemoryStore();
  return { store: { ...store, get: () => read }, finish };
}

const html = () => document.documentElement;

describe('AppearanceProvider and the page language (A-01)', () => {
  afterEach(() => {
    html().removeAttribute('lang');
    html().removeAttribute('dir');
  });

  it('puts the saved Urdu on the page as lang="ur" dir="rtl"', async () => {
    const store = createMemoryStore({ [APPEARANCE_KEY]: JSON.stringify({ locale: 'ur' }) });
    render(
      <AppearanceProvider store={store}>
        <Probe />
      </AppearanceProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('ur:true'));
    await waitFor(() => expect(html().lang).toBe('ur'));
    expect(html().dir).toBe('rtl');
  });

  it('puts English on the page as lang="en" dir="ltr", also when nothing or junk is saved', async () => {
    const saves: Record<string, string>[] = [
      { [APPEARANCE_KEY]: '{"locale":"en"}' },
      {},
      { [APPEARANCE_KEY]: '{' },
    ];
    for (const saved of saves) {
      html().lang = 'ur';
      html().dir = 'rtl';
      const view = render(
        <AppearanceProvider store={createMemoryStore(saved)}>
          <Probe />
        </AppearanceProvider>,
      );
      await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('en:true'));
      // The page attributes follow in an effect after the render that shows `ready`.
      await waitFor(() => expect(html().lang).toBe('en'));
      expect(html().dir).toBe('ltr');
      view.unmount();
    }
  });

  it('leaves the page as the start-up script set it until the saved choice is read', async () => {
    html().lang = 'ur';
    html().dir = 'rtl';
    const { store, finish } = slowStore(JSON.stringify({ locale: 'ur' }));
    render(
      <AppearanceProvider store={store}>
        <Probe />
      </AppearanceProvider>,
    );
    // Until the read, the provider takes the page's language (so the web downloads only the
    // words boot.js already asked for) and leaves the page alone.
    expect(screen.getByTestId('state').textContent).toBe('ur:false');
    expect(html().lang).toBe('ur');
    expect(html().dir).toBe('rtl');
    await act(async () => {
      finish();
    });
    expect(screen.getByTestId('state').textContent).toBe('ur:true');
    expect(html().dir).toBe('rtl');
  });

  it('starts in English before the read when the page is English, and fetches no Urdu', async () => {
    html().lang = 'en';
    html().dir = 'ltr';
    const asked: string[] = [];
    const loader = {
      isLoaded: () => false,
      load: (locale: 'en' | 'ur') => {
        asked.push(locale);
        return Promise.resolve();
      },
    };
    const { store, finish } = slowStore(null);
    render(
      <AppearanceProvider store={store} languages={loader}>
        <Probe />
      </AppearanceProvider>,
    );
    expect(screen.getByTestId('state').textContent).toBe('en:false');
    await act(async () => {
      finish();
    });
    await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('en:true'));
    expect(asked.every((locale) => locale === 'en')).toBe(true);
  });

  it('follows a change of language at once', async () => {
    render(
      <AppearanceProvider store={createMemoryStore()} initial={{ locale: 'en' }}>
        <Probe />
      </AppearanceProvider>,
    );
    expect(html().dir).toBe('ltr');
    await act(async () => {
      screen.getByTestId('switch').click();
    });
    expect(html().lang).toBe('ur');
    expect(html().dir).toBe('rtl');
    await act(async () => {
      screen.getByTestId('switch').click();
    });
    expect(html().lang).toBe('en');
    expect(html().dir).toBe('ltr');
  });
});

/** A loader whose downloads the test finishes or fails by hand; English is already in. */
function manualLanguages() {
  const installed = new Set<Locale>(['en']);
  const waiting: Partial<Record<Locale, { resolve: () => void; reject: () => void }>> = {};
  const loader = createLanguageLoader({
    tables: {
      en: () => Promise.resolve({ default: {} }),
      ur: () =>
        new Promise((resolve, reject) => {
          waiting.ur = {
            resolve: () => resolve({ default: {} }),
            reject: () => reject(new Error('offline')),
          };
        }),
    },
    install: (locale) => installed.add(locale),
    has: (locale) => installed.has(locale),
  });
  return { loader, waiting };
}

describe('AppearanceProvider and the languages the web downloads one at a time', () => {
  afterEach(() => {
    html().removeAttribute('lang');
    html().removeAttribute('dir');
  });

  it('is ready only once the saved language has downloaded', async () => {
    const { loader, waiting } = manualLanguages();
    const store = createMemoryStore({ [APPEARANCE_KEY]: JSON.stringify({ locale: 'ur' }) });
    render(
      <AppearanceProvider store={store} languages={loader}>
        <Probe />
      </AppearanceProvider>,
    );
    await waitFor(() => expect(waiting.ur).toBeDefined());
    expect(screen.getByTestId('state').textContent).toBe('en:false');
    await act(async () => waiting.ur?.resolve());
    await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('ur:true'));
    await waitFor(() => expect(html().lang).toBe('ur'));
  });

  it('switches once the new language is in, and not at all when it cannot be had', async () => {
    const { loader, waiting } = manualLanguages();
    const store = createMemoryStore();
    render(
      <AppearanceProvider store={store} languages={loader}>
        <Probe />
      </AppearanceProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('en:true'));

    fireEvent.click(screen.getByTestId('switch'));
    await waitFor(() => expect(waiting.ur).toBeDefined());
    await act(async () => waiting.ur?.reject());
    expect(screen.getByTestId('state').textContent).toBe('en:true');
    expect(await store.get(APPEARANCE_KEY)).toBeNull();

    waiting.ur = undefined;
    fireEvent.click(screen.getByTestId('switch'));
    await waitFor(() => expect(waiting.ur).toBeDefined());
    expect(screen.getByTestId('state').textContent).toBe('en:true');
    await act(async () => waiting.ur?.resolve());
    await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('ur:true'));
    expect(JSON.parse((await store.get(APPEARANCE_KEY)) ?? '{}')).toMatchObject({ locale: 'ur' });
  });
});
