import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { messages } from '@qc/i18n';
import { semanticColors, textScale } from '@qc/ui';
import { ARABIC_ZOOM_STEPS } from '../quran/prefs';
import { FAKE_OPENING, fakeArabic, fakeUrdu } from '../test/fakes';
import { createTestServices, matrix, renderContent, type TestServices } from '../test/render';
import { QuranReaderScreen } from './QuranReaderScreen';
import type { ReaderTarget } from './reader';

// All Quran text and translation in these tests is invented ("FAKE-AR 1:1"). Nothing is real text.

const msg = (locale: 'en' | 'ur', key: string, params: Record<string, string | number> = {}) =>
  ((messages[locale] as Record<string, string>)[key] as string).replace(
    /\{(\w+)\}/g,
    (_, name: string) => String(params[name]),
  );

const open = (
  t: TestServices,
  target: ReaderTarget,
  extra: { onShare?: (m: string) => void; combo?: Parameters<typeof renderContent>[2] } = {},
) =>
  renderContent(
    <QuranReaderScreen
      target={target}
      onBack={vi.fn()}
      {...(extra.onShare ? { onShare: extra.onShare } : {})}
    />,
    t.services,
    extra.combo ?? {},
  );

/** `#rrggbb` as the DOM reports it. */
const rgbOf = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

const arabicOf = (surah: number, ayah: number) => screen.getByTestId(`arabic-${surah}-${ayah}`);

describe.each(matrix)('QuranReaderScreen in $name', (combo) => {
  it('shows each ayah as Arabic (lang ar, right to left) with the Urdu translation under it', async () => {
    const t = createTestServices();
    open(t, { kind: 'surah', id: 1 }, { combo: { combo } });
    const ar = await screen.findByTestId('arabic-1-1');
    expect(ar.textContent).toBe(fakeArabic(1, 1));
    expect(ar.getAttribute('lang')).toBe('ar');
    expect(ar.getAttribute('dir')).toBe('rtl');
    expect(getComputedStyle(ar).fontFamily).toContain('AlMushaf');

    const ur = screen.getByTestId('urdu-1-1');
    expect(ur.textContent).toBe(fakeUrdu(1, 1));
    expect(ur.getAttribute('lang')).toBe('ur');
    expect(getComputedStyle(ur).fontFamily).not.toContain('AlMushaf');

    // The Arabic follows the app's text size (four steps) at the reader's default zoom, and the
    // colour mode: the text colour is the theme's.
    expect(parseFloat(ar.style.fontSize)).toBe(Math.round(28 * textScale[combo.textSize]));
    expect(getComputedStyle(ar).color).toBe(rgbOf(semanticColors[combo.mode].text));

    // The header and the controls speak the app language.
    expect(screen.getByText(msg(combo.locale, 'quran.reader.jump'))).toBeTruthy();
    expect(document.querySelector(`[dir="${combo.direction}"]`)).not.toBeNull();
  });
});

describe('QuranReaderScreen', () => {
  it('uses the Quran font for the Quran text only', async () => {
    const t = createTestServices();
    const { container } = open(t, { kind: 'surah', id: 1 });
    await screen.findByTestId('arabic-1-1');
    const inQuranFont = [...container.querySelectorAll<HTMLElement>('*')].filter((el) =>
      el.style.fontFamily.includes('AlMushaf'),
    );
    expect(inQuranFont.length).toBeGreaterThan(0);
    for (const el of inQuranFont) expect(el.getAttribute('lang')).toBe('ar');
  });

  it('puts the opening formula on its own line and removes it from the first ayah', async () => {
    const t = createTestServices();
    open(t, { kind: 'surah', id: 112 });
    expect((await screen.findByTestId('bismillah')).textContent).toBe(FAKE_OPENING);
    expect(arabicOf(112, 1).textContent).toBe('FAKE-AR 112:1');
  });

  it('has no separate formula line for Al-Fatihah or At-Tawbah', async () => {
    const t = createTestServices();
    open(t, { kind: 'surah', id: 9 });
    await screen.findByTestId('arabic-9-1');
    expect(screen.queryByTestId('bismillah')).toBeNull();
  });

  it('shows the Arabic only when the translation is switched off, and remembers the choice', async () => {
    const t = createTestServices();
    open(t, { kind: 'surah', id: 1 });
    await screen.findByTestId('urdu-1-1');
    fireEvent.click(screen.getByTestId('reader-settings'));
    fireEvent.click(
      await screen.findByRole('switch', { name: msg('en', 'quran.translation.show') }),
    );
    await waitFor(() => expect(screen.queryByTestId('urdu-1-1')).toBeNull());
    expect(arabicOf(1, 1)).toBeTruthy();
    await waitFor(async () => expect((await t.services.prefs.load()).showTranslation).toBe(false));
  });

  it('says so when an ayah has no translation', async () => {
    const t = createTestServices();
    t.quranApi.withoutTranslation = true;
    open(t, { kind: 'surah', id: 1 });
    await screen.findByTestId('arabic-1-1');
    expect(screen.getAllByText(msg('en', 'quran.reader.translationMissing')).length).toBe(7);
  });

  it('changes the Arabic size one step at a time, within the limits', async () => {
    const t = createTestServices();
    open(t, { kind: 'surah', id: 1 });
    await screen.findByTestId('arabic-1-1');
    const size = () => parseFloat(arabicOf(1, 1).style.fontSize);
    const base = size();
    fireEvent.click(screen.getByTestId('reader-settings'));
    expect(screen.getByTestId('zoom-value').textContent).toBe(
      msg('en', 'quran.reader.sizeValue', { step: 2, total: ARABIC_ZOOM_STEPS.length }),
    );
    fireEvent.click(screen.getByTestId('zoom-larger'));
    await waitFor(() => expect(size()).toBeGreaterThan(base));
    expect(screen.getByTestId('zoom-value').textContent).toContain('3');
    fireEvent.click(screen.getByTestId('zoom-smaller'));
    fireEvent.click(screen.getByTestId('zoom-smaller'));
    await waitFor(() => expect(size()).toBeLessThan(base));
    // At the smallest step the button is off.
    expect(
      screen.getByTestId('zoom-smaller').hasAttribute('disabled') ||
        screen.getByTestId('zoom-smaller').getAttribute('aria-disabled') === 'true',
    ).toBe(true);
    await waitFor(async () => expect((await t.services.prefs.load()).arabicZoomIndex).toBe(0));
  });

  it('opens at the asked-for ayah and marks it', async () => {
    const t = createTestServices();
    open(t, { kind: 'surah', id: 18, ayah: 60 });
    const verse = await screen.findByTestId('verse-18-60');
    // A bar at the start side marks the ayah the person asked for.
    expect(verse.getAttribute('style')).toMatch(/border-(left|right)-width: 4px/);
    expect(screen.getByTestId('verse-18-59').getAttribute('style')).toMatch(
      /border-(left|right)-width: 0px/,
    );
  });

  it('jumps to an ayah, saves it as the place, and rejects numbers that do not exist', async () => {
    const t = createTestServices();
    open(t, { kind: 'surah', id: 18 });
    await screen.findByTestId('arabic-18-1');

    fireEvent.click(screen.getByTestId('reader-jump'));
    const input = await screen.findByTestId('jump-input');
    fireEvent.change(input, { target: { value: '999' } });
    fireEvent.click(screen.getByTestId('jump-go'));
    expect(
      await screen.findByText(msg('en', 'quran.reader.jump.invalid', { max: 110 })),
    ).toBeTruthy();
    expect(await t.services.readingPosition.getLocal()).toBeNull();

    fireEvent.change(input, { target: { value: '100' } });
    fireEvent.click(screen.getByTestId('jump-go'));
    expect(await screen.findByTestId('verse-18-100')).toBeTruthy();
    await waitFor(async () =>
      expect(await t.services.readingPosition.getLocal()).toMatchObject({ surah: 18, ayah: 100 }),
    );
  });

  it('jumps inside a juz by ayah number or by surah:ayah', async () => {
    const t = createTestServices();
    open(t, { kind: 'juz', id: 30 });
    await screen.findByTestId('arabic-78-1');
    fireEvent.click(screen.getByTestId('reader-jump'));
    const input = await screen.findByTestId('jump-input');
    fireEvent.change(input, { target: { value: '2:255' } });
    fireEvent.click(screen.getByTestId('jump-go'));
    expect(await screen.findByText(msg('en', 'quran.reader.jump.invalidJuz'))).toBeTruthy();
    fireEvent.change(input, { target: { value: '112:3' } });
    fireEvent.click(screen.getByTestId('jump-go'));
    await waitFor(async () =>
      expect(await t.services.readingPosition.getLocal()).toMatchObject({ surah: 112, ayah: 3 }),
    );
  });

  it('shows each surah of a juz under its name', async () => {
    const t = createTestServices();
    open(t, { kind: 'juz', id: 30 });
    await screen.findByTestId('arabic-78-1');
    expect(screen.getByText(msg('en', 'quran.juz.title', { number: 30 }))).toBeTruthy();
    expect(
      screen.getAllByText(msg('en', 'quran.surah.title', { name: 'An-Naba' })).length,
    ).toBeGreaterThan(0);
  });

  it('bookmarks and un-bookmarks an ayah, with names that say which ayah', async () => {
    const t = createTestServices();
    open(t, { kind: 'surah', id: 1 });
    await screen.findByTestId('arabic-1-3');
    const add = screen.getByRole('button', {
      name: msg('en', 'quran.bookmark.addLabel', { number: 3 }),
    });
    fireEvent.click(add);
    const remove = await screen.findByRole('button', {
      name: msg('en', 'quran.bookmark.removeLabel', { number: 3 }),
    });
    expect(await t.services.bookmarks.list()).toHaveLength(1);
    expect(await t.services.bookmarks.isBookmarked({ surah: 1, ayah: 3 })).toBe(true);
    fireEvent.click(remove);
    await screen.findByRole('button', {
      name: msg('en', 'quran.bookmark.addLabel', { number: 3 }),
    });
    expect(await t.services.bookmarks.list()).toHaveLength(0);
  });

  it('shares the ayah with its reference', async () => {
    const t = createTestServices();
    const onShare = vi.fn();
    open(t, { kind: 'surah', id: 1 }, { onShare });
    await screen.findByTestId('arabic-1-2');
    fireEvent.click(screen.getByTestId('share-1-2'));
    expect(onShare).toHaveBeenCalledWith(
      [msg('en', 'quran.share.title', { key: '1:2' }), fakeArabic(1, 2), fakeUrdu(1, 2)].join('\n'),
    );
  });

  it('moves to the next and previous surah, and disables the ends', async () => {
    const t = createTestServices();
    const onTargetChange = vi.fn();
    renderContent(
      <QuranReaderScreen
        target={{ kind: 'surah', id: 1 }}
        onBack={vi.fn()}
        onTargetChange={onTargetChange}
      />,
      t.services,
    );
    await screen.findByTestId('arabic-1-1');
    const previous = screen.getByTestId('reader-previous-surah');
    expect(
      previous.hasAttribute('disabled') || previous.getAttribute('aria-disabled') === 'true',
    ).toBe(true);
    fireEvent.click(screen.getByTestId('reader-next-surah'));
    await screen.findByTestId('arabic-2-1');
    expect(onTargetChange).toHaveBeenLastCalledWith({ kind: 'surah', id: 2 });
    expect(
      screen.getByRole('heading', { name: msg('en', 'quran.surah.title', { name: 'Al-Baqarah' }) }),
    ).toBeTruthy();
  });

  it('orders previous and next like the Quran turns, right to left, in both languages', async () => {
    for (const locale of ['en', 'ur'] as const) {
      const t = createTestServices();
      const view = open(t, { kind: 'surah', id: 5 }, { combo: { combo: { locale } } });
      await screen.findByTestId('arabic-5-1');
      const pager = screen.getByTestId('reader-previous-surah').parentElement as HTMLElement;
      const direction = locale === 'en' ? 'row-reverse' : 'row';
      expect(getComputedStyle(pager).flexDirection).toBe(direction);
      view.unmount();
    }
  });

  it('picks a surah from the list by name', async () => {
    const t = createTestServices();
    open(t, { kind: 'surah', id: 1 });
    await screen.findByTestId('arabic-1-1');
    fireEvent.click(screen.getByTestId('reader-surahs'));
    const sheet = await screen.findByTestId('surahs-sheet');
    fireEvent.change(within(sheet).getByTestId('reader-surah-search'), {
      target: { value: 'kahf' },
    });
    fireEvent.click(await within(sheet).findByTestId('reader-surah-18'));
    expect(await screen.findByTestId('arabic-18-1')).toBeTruthy();
  });

  it('keeps the page the person is on when the next surah cannot be fetched, and retries', async () => {
    const t = createTestServices();
    open(t, { kind: 'surah', id: 1 });
    await screen.findByTestId('arabic-1-1');
    t.quranApi.offline = true;
    fireEvent.click(screen.getByTestId('reader-next-surah'));
    expect(await screen.findByTestId('reader-error-notice')).toBeTruthy();
    expect(screen.getByTestId('arabic-1-1')).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: msg('en', 'quran.surah.title', { name: 'Al-Fatihah' }) }),
    ).toBeTruthy();

    t.quranApi.offline = false;
    fireEvent.click(within(screen.getByTestId('reader-error-notice')).getByRole('button'));
    expect(await screen.findByTestId('arabic-2-1')).toBeTruthy();
    expect(screen.queryByTestId('reader-error-notice')).toBeNull();
  });

  it('says a surah that was never opened cannot be read offline, and recovers online', async () => {
    const t = createTestServices();
    t.quranApi.offline = true;
    open(t, { kind: 'surah', id: 3 });
    const error = await screen.findByTestId('reader-error');
    expect(error.textContent).toContain(msg('en', 'quran.reader.offlineUncached'));
    t.quranApi.offline = false;
    fireEvent.click(within(error).getByRole('button', { name: msg('en', 'ui.retry') }));
    expect(await screen.findByTestId('arabic-3-1')).toBeTruthy();
  });

  it('opens a surah read before with no connection, and says when the copy is old', async () => {
    const t = createTestServices();
    const first = open(t, { kind: 'surah', id: 1 });
    await screen.findByTestId('arabic-1-1');
    first.unmount();

    t.clock.advance(31 * 24 * 3_600_000);
    t.quranApi.offline = true;
    open(t, { kind: 'surah', id: 1 });
    expect(await screen.findByTestId('arabic-1-1')).toBeTruthy();
    expect(screen.getByTestId('reader-stale-note').textContent).toBe(
      msg('en', 'quran.reader.staleNote'),
    );
  });

  it('goes back', async () => {
    const t = createTestServices();
    const onBack = vi.fn();
    renderContent(
      <QuranReaderScreen target={{ kind: 'surah', id: 1 }} onBack={onBack} />,
      t.services,
    );
    await screen.findByTestId('arabic-1-1');
    fireEvent.click(screen.getByRole('button', { name: msg('en', 'ui.back') }));
    expect(onBack).toHaveBeenCalled();
  });

  it('does not touch the network for text it already has', async () => {
    const t = createTestServices();
    const first = open(t, { kind: 'surah', id: 1 });
    await screen.findByTestId('arabic-1-1');
    first.unmount();
    const calls = t.quranApi.calls.length;
    open(t, { kind: 'surah', id: 1 });
    await screen.findByTestId('arabic-1-1');
    await act(async () => {
      await Promise.resolve();
    });
    expect(t.quranApi.calls.length).toBe(calls);
  });
});
