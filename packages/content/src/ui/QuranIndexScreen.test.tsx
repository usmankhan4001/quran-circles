import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { messages } from '@qc/i18n';
import { createTestServices, matrix, renderContent } from '../test/render';
import { QuranIndexScreen } from './QuranIndexScreen';

const msg = (locale: 'en' | 'ur', key: string, params: Record<string, string | number> = {}) =>
  ((messages[locale] as Record<string, string>)[key] as string).replace(
    /\{(\w+)\}/g,
    (_, name: string) => String(params[name]),
  );

const search = (text: string) =>
  fireEvent.change(screen.getByTestId('surah-search'), { target: { value: text } });

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

  it('has a labelled search box and the three tabs', () => {
    const { services } = createTestServices();
    renderContent(<QuranIndexScreen onOpen={vi.fn()} />, services, { combo });
    expect(screen.getByLabelText(msg(combo.locale, 'quran.search'))).toBeTruthy();
    for (const key of ['quran.tab.surah', 'quran.tab.juz', 'quran.tab.bookmarks']) {
      expect(screen.getByRole('radio', { name: msg(combo.locale, key) })).toBeTruthy();
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
    fireEvent.click(screen.getByRole('radio', { name: msg('en', 'quran.tab.juz') }));
    const row = screen.getByTestId('juz-row-2');
    expect(row.textContent).toContain('Juz 2');
    expect(row.textContent).toContain('Starts at Al-Baqarah, ayah 142');
    fireEvent.click(row);
    expect(onOpen).toHaveBeenCalledWith({ kind: 'juz', id: 2 });
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
    fireEvent.click(await screen.findByRole('button', { name: msg('en', 'quran.continue') }));
    expect(onOpen).toHaveBeenCalledWith({ kind: 'surah', id: 18, ayah: 10 });
  });
});
