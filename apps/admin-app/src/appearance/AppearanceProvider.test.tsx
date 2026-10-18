import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Pressable, Text } from 'react-native';
import { createMemoryStore, type KeyValueStore } from '../storage/storage';
import { APPEARANCE_KEY, AppearanceProvider, useAppearance } from './AppearanceProvider';

function Probe() {
  const { locale, ready, setLocale } = useAppearance();
  return (
    <Pressable testID="switch" onPress={() => setLocale(locale === 'ur' ? 'en' : 'ur')}>
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
    expect(html().lang).toBe('ur');
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
      expect(html().lang).toBe('en');
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
    // The default is English, but it never reaches the page.
    expect(screen.getByTestId('state').textContent).toBe('en:false');
    expect(html().lang).toBe('ur');
    expect(html().dir).toBe('rtl');
    await act(async () => {
      finish();
    });
    expect(screen.getByTestId('state').textContent).toBe('ur:true');
    expect(html().dir).toBe('rtl');
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
