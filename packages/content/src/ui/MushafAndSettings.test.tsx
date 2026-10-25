import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { messages } from '@qc/i18n';
import { DEFAULT_READER_PREFS } from '../quran/prefs';
import { fakeArabic } from '../test/fakes';
import { createTestServices, matrix, renderContent, type TestServices } from '../test/render';
import { QuranReaderScreen } from './QuranReaderScreen';
import type { ReaderTarget } from './reader';

// All text is invented ("FAKE-AR 1:1"). The fake source puts the first 8 ayahs of surah N on page N.

const msg = (locale: 'en' | 'ur', key: string, params: Record<string, string | number> = {}) =>
  ((messages[locale] as Record<string, string>)[key] as string).replace(
    /\{(\w+)\}/g,
    (_, name: string) => String(params[name]),
  );

async function openMushaf(
  t: TestServices,
  target: ReaderTarget,
  combo?: Parameters<typeof renderContent>[2],
) {
  await t.services.prefs.save({ ...DEFAULT_READER_PREFS, layout: 'mushaf' });
  return renderContent(
    <QuranReaderScreen target={target} onBack={vi.fn()} />,
    t.services,
    combo ?? {},
  );
}

describe.each(matrix)('Mushaf page view in $name', (combo) => {
  it('shows the page as Arabic only, with its number and the text credit', async () => {
    const t = createTestServices();
    await openMushaf(t, { kind: 'surah', id: 1 }, { combo });
    const page = await screen.findByTestId('mushaf-page');
    expect(page).toBeTruthy();
    const text = await screen.findByTestId('mushaf-ayah-1-1');
    expect(text.textContent).toContain(fakeArabic(1, 1).replace(/^.*?(?=FAKE)/, ''));
    // Arabic only: no translation rows, whatever the app language.
    expect(screen.queryByTestId('translation-1-1')).toBeNull();
    expect(screen.getByTestId('mushaf-page-count').textContent).toBe(
      msg(combo.locale, 'quran.mushaf.pageOf', { page: 1, total: 604 }),
    );
    expect(screen.getByTestId('reader-text-credit').textContent).toBe(
      msg(combo.locale, 'quran.credit.arabic'),
    );
  });
});

describe('Mushaf page view', () => {
  it('opens on the page of the asked-for ayah and turns pages', async () => {
    const t = createTestServices();
    await openMushaf(t, { kind: 'surah', id: 4, ayah: 3 });
    await screen.findByTestId('mushaf-ayah-4-3');
    expect(screen.getByTestId('mushaf-page-count').textContent).toBe(
      msg('en', 'quran.mushaf.pageOf', { page: 4, total: 604 }),
    );
    fireEvent.click(screen.getByTestId('mushaf-next'));
    await screen.findByTestId('mushaf-ayah-5-1');
    fireEvent.click(screen.getByTestId('mushaf-previous'));
    await screen.findByTestId('mushaf-ayah-4-1');
  });

  it('disables the pager at the first page', async () => {
    const t = createTestServices();
    await openMushaf(t, { kind: 'surah', id: 1 });
    await screen.findByTestId('mushaf-ayah-1-1');
    const previous = screen.getByTestId('mushaf-previous');
    expect(
      previous.hasAttribute('disabled') || previous.getAttribute('aria-disabled') === 'true',
    ).toBe(true);
  });

  it('says a page that was never read cannot be opened offline, and recovers online', async () => {
    const t = createTestServices();
    t.quranApi.offline = true;
    await openMushaf(t, { kind: 'surah', id: 3 });
    const error = await screen.findByTestId('mushaf-error');
    t.quranApi.offline = false;
    fireEvent.click(within(error).getByRole('button', { name: msg('en', 'ui.retry') }));
    await waitFor(() => expect(screen.queryByTestId('mushaf-error')).toBeNull());
  });
});

describe('Reading settings sheet', () => {
  const openSheet = async () => {
    const t = createTestServices();
    renderContent(
      <QuranReaderScreen target={{ kind: 'surah', id: 1 }} onBack={vi.fn()} />,
      t.services,
    );
    await screen.findByTestId('arabic-1-1');
    fireEvent.click(screen.getByTestId('reader-settings'));
    return { t, sheet: await screen.findByTestId('settings-sheet') };
  };

  it('marks IndoPak, extra translators and the reciter as coming soon, not working', async () => {
    const { sheet } = await openSheet();
    const soon = msg('en', 'quran.reader.soon');
    const indopak = within(sheet).getByRole('radio', {
      name: msg('en', 'quran.reader.script.indopak'),
    });
    expect(
      indopak.hasAttribute('disabled') || indopak.getAttribute('aria-disabled') === 'true',
    ).toBe(true);
    expect(within(sheet).getByTestId('reader-more-translators').textContent).toContain(soon);
    expect(within(sheet).getByTestId('reader-reciter').textContent).toContain(soon);
    // Only one translator is real: Maududi's, shown as chosen.
    expect(within(sheet).getByTestId('translator-maududi')).toBeTruthy();
  });

  it('keeps Uthmani as the script and cannot be moved to IndoPak', async () => {
    const { t, sheet } = await openSheet();
    fireEvent.click(
      within(sheet).getByRole('radio', { name: msg('en', 'quran.reader.script.indopak') }),
    );
    expect((await t.services.prefs.load()).script).toBe('uthmani');
  });

  it('switches the layout and the look, and remembers both', async () => {
    const { t, sheet } = await openSheet();
    fireEvent.click(
      within(sheet).getByRole('radio', { name: msg('en', 'quran.reader.theme.night') }),
    );
    await waitFor(async () => expect((await t.services.prefs.load()).theme).toBe('night'));
    fireEvent.click(
      within(sheet).getByRole('radio', { name: msg('en', 'quran.reader.layout.mushaf') }),
    );
    await waitFor(async () => expect((await t.services.prefs.load()).layout).toBe('mushaf'));
    expect(await screen.findByTestId('reader-mushaf')).toBeTruthy();
  });

  it('hides the translator rows when the translation is off', async () => {
    const { sheet } = await openSheet();
    expect(within(sheet).getByTestId('translator-maududi')).toBeTruthy();
    fireEvent.click(within(sheet).getByTestId('translation-switch'));
    await waitFor(() => expect(within(sheet).queryByTestId('translator-maududi')).toBeNull());
    expect(within(sheet).queryByTestId('reader-more-translators')).toBeNull();
  });
});
