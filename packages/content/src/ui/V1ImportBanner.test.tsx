import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { messages } from '@qc/i18n';
import { ThemeProvider } from '@qc/ui';
import { V1_KEYS } from '../bookmarks/v1Import';
import { createTestServices, matrix, renderContent } from '../test/render';
import { ContentProvider } from './context';
import { V1ImportBanner } from './V1ImportBanner';

const msg = (locale: 'en' | 'ur', key: string, params: Record<string, string | number> = {}) =>
  ((messages[locale] as Record<string, string>)[key] as string).replace(
    /\{(\w+)\}/g,
    (_, name: string) => String(params[name]),
  );

const V1 = {
  [V1_KEYS.bookmarks]: '["2:255","18:10"]',
  [V1_KEYS.lastRead]: '{"mode":"surah","id":18,"name":"Al-Kahf","detail":"x"}',
};

describe.each(matrix)('V1ImportBanner in $name', (combo) => {
  it('offers the import in the app language', async () => {
    const t = createTestServices({ signedIn: true, v1: V1 });
    renderContent(<V1ImportBanner />, t.services, { combo, signedIn: true });
    expect(
      await screen.findByText(msg(combo.locale, 'quran.import.body.other', { count: 2 })),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: msg(combo.locale, 'quran.import.action') }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: msg(combo.locale, 'quran.import.skip') }),
    ).toBeTruthy();
  });
});

describe('V1ImportBanner', () => {
  it('shows nothing when there is no V1 data to look for', async () => {
    const t = createTestServices({ signedIn: true });
    const view = renderContent(<V1ImportBanner />, t.services, { signedIn: true });
    await act(async () => {
      await Promise.resolve();
    });
    expect(view.container.textContent).toBe('');
  });

  it('waits for sign-in, then offers the import', async () => {
    const t = createTestServices({ v1: V1 });
    const tree = (signedIn: boolean) => (
      <ThemeProvider reduceMotion>
        <ContentProvider services={t.services} signedIn={signedIn}>
          <V1ImportBanner />
        </ContentProvider>
      </ThemeProvider>
    );
    const view = render(tree(false));
    await act(async () => {
      await Promise.resolve();
    });
    expect(view.container.textContent).toBe('');

    t.signIn();
    view.rerender(tree(true));
    expect(
      await screen.findByRole('button', { name: msg('en', 'quran.import.action') }),
    ).toBeTruthy();
  });

  it('brings the bookmarks and the place over to the account', async () => {
    const t = createTestServices({ signedIn: true, v1: V1 });
    renderContent(<V1ImportBanner />, t.services, { signedIn: true });
    fireEvent.click(await screen.findByTestId('v1-import-run'));
    expect((await screen.findByTestId('v1-import-done')).textContent).toBe(
      msg('en', 'quran.import.done.other', { count: 2 }),
    );
    expect(t.account.bookmarks).toHaveLength(2);
    expect(t.account.position).toMatchObject({ surah: 18 });
    expect(await t.services.bookmarks.list()).toHaveLength(2);
    expect(await t.services.readingPosition.getLocal()).toMatchObject({ surah: 18 });
  });

  it('uses the singular for one bookmark', async () => {
    const t = createTestServices({ signedIn: true, v1: { [V1_KEYS.bookmarks]: '["1:1"]' } });
    renderContent(<V1ImportBanner />, t.services, { signedIn: true });
    expect(await screen.findByText(msg('en', 'quran.import.body.one', { count: 1 }))).toBeTruthy();
  });

  it('offers the place alone when there are no bookmarks', async () => {
    const t = createTestServices({
      signedIn: true,
      v1: { [V1_KEYS.lastRead]: '{"mode":"surah","id":18,"name":"x","detail":"x"}' },
    });
    renderContent(<V1ImportBanner />, t.services, { signedIn: true });
    expect(await screen.findByText(msg('en', 'quran.import.bodyPlace'))).toBeTruthy();
  });

  it('keeps the offer when the import fails, and succeeds on a second try', async () => {
    const t = createTestServices({ signedIn: true, v1: V1 });
    renderContent(<V1ImportBanner />, t.services, { signedIn: true });
    const run = await screen.findByTestId('v1-import-run');
    t.account.offline = true;
    fireEvent.click(run);
    expect((await screen.findByTestId('v1-import-error')).textContent).toBe(
      msg('en', 'quran.import.error'),
    );
    expect(screen.getByTestId('v1-import-run')).toBeTruthy();

    t.account.offline = false;
    fireEvent.click(screen.getByTestId('v1-import-run'));
    await screen.findByTestId('v1-import-done');
    expect(t.account.bookmarks).toHaveLength(2);
  });

  it('does not ask again once the person says no thanks', async () => {
    const t = createTestServices({ signedIn: true, v1: V1 });
    const first = renderContent(<V1ImportBanner />, t.services, { signedIn: true });
    fireEvent.click(await screen.findByTestId('v1-import-skip'));
    await waitFor(() => expect(first.container.textContent).toBe(''));
    first.unmount();

    const again = renderContent(<V1ImportBanner />, t.services, { signedIn: true });
    await act(async () => {
      await Promise.resolve();
    });
    expect(again.container.textContent).toBe('');
    expect(t.account.bookmarks).toHaveLength(0);
  });
});
