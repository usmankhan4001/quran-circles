import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { messages } from '@qc/i18n';
import { fonts, semanticColors } from '@qc/ui';
import { createTestServices, matrix, renderContent } from '../test/render';
import { QuranIndexScreen } from './QuranIndexScreen';

const msg = (locale: 'en' | 'ur', key: string, params: Record<string, string | number> = {}) =>
  ((messages[locale] as Record<string, string>)[key] as string).replace(
    /\{(\w+)\}/g,
    (_, name: string) => String(params[name]),
  );

/** `#rrggbb` as the DOM reports it. */
const rgbOf = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

const search = (text: string) => {
  // The search field opens from the round search button beside the tabs (D17).
  if (!screen.queryByTestId('surah-search'))
    fireEvent.click(screen.getByTestId('surah-search-toggle'));
  fireEvent.change(screen.getByTestId('surah-search'), { target: { value: text } });
};

describe.each(matrix)('QuranIndexScreen in $name', (combo) => {
  it('lists the surahs with the Arabic name in the Quran font, and opens one', () => {
    const { services } = createTestServices();
    const onOpen = vi.fn();
    renderContent(<QuranIndexScreen onOpen={onOpen} />, services, { combo });

    const row = screen.getByTestId('surah-row-2');
    expect(row.textContent).toContain('Al-Baqarah');
    expect(row.textContent).toContain('286');
    const arabic = within(row).getByText('البقرة');
    expect(arabic.getAttribute('lang')).toBe('ar');
    expect(arabic.getAttribute('dir')).toBe('rtl');
    expect(document.querySelector(`[dir="${combo.direction}"]`)).not.toBeNull();

    fireEvent.click(screen.getByTestId('surah-row-2'));
    expect(onOpen).toHaveBeenCalledWith({ kind: 'surah', id: 2 });
  });

  it('draws each surah as drawn: number in the star, Arabic name at the row end in the Quran font', () => {
    const { services } = createTestServices();
    renderContent(<QuranIndexScreen onOpen={vi.fn()} />, services, { combo });
    const row = screen.getByTestId('surah-row-2');
    const star = within(row).getByTestId('surah-number-2');
    expect(star.textContent).toBe('2');
    // The row says the number once; the star itself is not read out again.
    expect(row.getAttribute('aria-label')).toContain('2. Al-Baqarah');

    const arabic = within(row).getByTestId('surah-arabic-2');
    expect(arabic.textContent).toBe('البقرة');
    expect(arabic.getAttribute('lang')).toBe('ar');
    expect(getComputedStyle(arabic).fontFamily).toContain(fonts.quran);
    // D17: the Arabic name is in the text colour, on a white card with a hairline.
    expect(getComputedStyle(arabic).color).toBe(rgbOf(semanticColors[combo.mode].text));
    // The star comes first in the row and the Arabic name last, in either direction.
    const order = star.compareDocumentPosition(arabic);
    expect(order & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('marks a surah saved on this phone, and says so to a screen reader', async () => {
    const { services } = createTestServices();
    await services.source.getSurah(1);
    renderContent(<QuranIndexScreen onOpen={vi.fn()} />, services, { combo });
    const mark = await screen.findByTestId('surah-saved-1');
    expect(mark.getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByTestId('surah-row-1').getAttribute('aria-label')).toContain(
      msg(combo.locale, 'quran.offline.saved'),
    );
    expect(screen.queryByTestId('surah-saved-2')).toBeNull();
    expect(screen.getByTestId('surah-row-2').getAttribute('aria-label')).not.toContain(
      msg(combo.locale, 'quran.offline.saved'),
    );
  });

  it('has a labelled search box and the three tabs', () => {
    const { services } = createTestServices();
    renderContent(<QuranIndexScreen onOpen={vi.fn()} />, services, { combo });
    expect(screen.getByRole('searchbox', { name: msg(combo.locale, 'quran.search') })).toBeTruthy();
    // Underlined tabs: Surahs, Juz and Saved.
    for (const key of ['quran.tab.surah', 'quran.tab.juz', 'quran.tab.saved']) {
      expect(
        screen.getByRole('tab', { name: msg(combo.locale, key) }),
      ).toBeTruthy();
    }
  });
});

describe('QuranIndexScreen search', () => {
  it.each([
    ['baqara', 2],
    ['Al-Baqarah', 2],
    ['yaseen', 36],
    ['rehman', 55],
    ['kahf', 18],
    ['114', 114],
  ])('finds surah %s by its English or Roman Urdu name', (query, id) => {
    const { services } = createTestServices();
    renderContent(<QuranIndexScreen onOpen={vi.fn()} />, services);
    search(query);
    expect(screen.getByTestId(`surah-row-${id}`)).toBeTruthy();
  });

  it('finds a surah by its name in Arabic script', () => {
    const { services } = createTestServices();
    renderContent(<QuranIndexScreen onOpen={vi.fn()} />, services, { combo: { locale: 'ur' } });
    search('الرحمن');
    expect(screen.getByTestId('surah-row-55')).toBeTruthy();
    expect(screen.queryByTestId('surah-row-1')).toBeNull();
  });

  it('says so when nothing matches, and recovers when the search is cleared', () => {
    const { services } = createTestServices();
    renderContent(<QuranIndexScreen onOpen={vi.fn()} />, services);
    search('999');
    expect(screen.getByTestId('surah-search-empty')).toBeTruthy();
    expect(screen.getByText(msg('en', 'quran.search.empty.title'))).toBeTruthy();
    search('');
    expect(screen.queryByTestId('surah-search-empty')).toBeNull();
    expect(screen.getByTestId('surah-row-1')).toBeTruthy();
  });
});

describe('QuranIndexScreen juz and bookmarks', () => {
  it('lists the juz with where each starts, and opens one', () => {
    const { services } = createTestServices();
    const onOpen = vi.fn();
    renderContent(<QuranIndexScreen onOpen={onOpen} />, services);
    fireEvent.click(screen.getByRole('tab', { name: 'Juz' }));
    const row = screen.getByTestId('juz-row-2');
    expect(row.textContent).toContain('Juz 2');
    expect(row.textContent).toContain('Starts at Al-Baqarah, ayah 142');
    fireEvent.click(row);
    expect(onOpen).toHaveBeenCalledWith({ kind: 'juz', id: 2 });
  });

  it('puts each juz number in the star and names the row', () => {
    const { services } = createTestServices();
    renderContent(<QuranIndexScreen onOpen={vi.fn()} initialTab="juz" />, services);
    const row = screen.getByTestId('juz-row-2');
    expect(within(row).getByTestId('juz-number-2').textContent).toBe('2');
    expect(row.getAttribute('aria-label')).toBe('Juz 2. Starts at Al-Baqarah, ayah 142');
  });

  it('marks no surah when nothing is saved, and only surahs (not a juz or one ayah)', async () => {
    const { services } = createTestServices();
    await services.source.getJuz(30);
    await services.source.getAyah(2, 255);
    const spy = vi.spyOn(services.source, 'cachedPassages');
    renderContent(<QuranIndexScreen onOpen={vi.fn()} />, services);
    await waitFor(() => expect(spy).toHaveBeenCalled());
    await spy.mock.results[0]?.value;
    expect(screen.queryByTestId('surah-saved-1')).toBeNull();
    expect(screen.queryByTestId('surah-saved-2')).toBeNull();
  });

  it('still lists the surahs when the saved list cannot be read', async () => {
    const { services } = createTestServices();
    const spy = vi
      .spyOn(services.source, 'cachedPassages')
      .mockRejectedValue(new Error('storage gone'));
    renderContent(<QuranIndexScreen onOpen={vi.fn()} />, services);
    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(screen.getByTestId('surah-row-1')).toBeTruthy();
    expect(screen.queryByTestId('surah-saved-1')).toBeNull();
  });

  it('shows the empty message and the on-this-phone note while signed out', async () => {
    const { services } = createTestServices();
    renderContent(<QuranIndexScreen onOpen={vi.fn()} initialTab="bookmarks" />, services);
    expect(await screen.findByTestId('bookmarks-empty')).toBeTruthy();
    expect(screen.getByText(msg('en', 'quran.bookmarks.empty'))).toBeTruthy();
    expect(screen.getByTestId('bookmarks-local-note')).toBeTruthy();
  });

  it('hides the on-this-phone note when signed in', async () => {
    const { services } = createTestServices({ signedIn: true });
    renderContent(<QuranIndexScreen onOpen={vi.fn()} initialTab="bookmarks" />, services, {
      signedIn: true,
    });
    await screen.findByTestId('bookmarks-empty');
    expect(screen.queryByTestId('bookmarks-local-note')).toBeNull();
  });

  it('lists a bookmark, opens it at the ayah, and removes it', async () => {
    const { services } = createTestServices();
    await services.bookmarks.toggleAyah({ surah: 2, ayah: 255 });
    const onOpen = vi.fn();
    renderContent(<QuranIndexScreen onOpen={onOpen} initialTab="bookmarks" />, services);

    const open = await screen.findByRole('button', { name: 'Al-Baqarah, ayah 255' });
    fireEvent.click(open);
    expect(onOpen).toHaveBeenCalledWith({ kind: 'surah', id: 2, ayah: 255 });

    const remove = screen.getByRole('button', {
      name: msg('en', 'quran.bookmark.removeItem', { place: 'Al-Baqarah, ayah 255' }),
    });
    fireEvent.click(remove);
    expect(await screen.findByTestId('bookmarks-empty')).toBeTruthy();
    expect(await services.bookmarks.list()).toEqual([]);
  });

  it('shows the continue card only after something was read', async () => {
    const { services } = createTestServices();
    await services.readingPosition.save(18, 10);
    const onOpen = vi.fn();
    renderContent(<QuranIndexScreen onOpen={onOpen} />, services);
    fireEvent.click(
      await screen.findByRole('button', { name: new RegExp(msg('en', 'quran.continueAt', { ayah: 10 })) }),
    );
    expect(onOpen).toHaveBeenCalledWith({ kind: 'surah', id: 18, ayah: 10 });
  });
});
