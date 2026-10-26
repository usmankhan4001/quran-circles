import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { messages } from '@qc/i18n';
import { createTestServices, matrix, renderContent } from '../test/render';
import { QuranPrayerTab } from './QuranPrayerTab';

const msg = (locale: 'en' | 'ur', key: string, params: Record<string, string | number> = {}) =>
  ((messages[locale] as Record<string, string>)[key] as string).replace(
    /\{(\w+)\}/g,
    (_, name: string) => String(params[name]),
  );

const AT_17_00 = '2026-10-16T12:00:00.000Z';

describe.each(matrix)('QuranPrayerTab in $name', (combo) => {
  it('has a header, the Quran/Prayer switch and the surah list', async () => {
    const t = createTestServices({ now: AT_17_00 });
    renderContent(<QuranPrayerTab />, t.services, { combo });
    expect(await screen.findByTestId('surah-row-1')).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: msg(combo.locale, 'tabs.quranPrayer') }),
    ).toBeTruthy();
    expect(screen.getByRole('radio', { name: msg(combo.locale, 'quran.tab.quran') })).toBeTruthy();
    expect(screen.getByRole('radio', { name: msg(combo.locale, 'quran.tab.prayer') })).toBeTruthy();
  });
});

describe('QuranPrayerTab', () => {
  it('remembers which half was open', async () => {
    const t = createTestServices({ now: AT_17_00 });
    const first = renderContent(<QuranPrayerTab />, t.services);
    await screen.findByTestId('surah-row-1');
    fireEvent.click(screen.getByRole('radio', { name: msg('en', 'quran.tab.prayer') }));
    expect(await screen.findByText(msg('en', 'prayer.noCity.title'))).toBeTruthy();
    await waitFor(async () => expect((await t.services.viewState.load()).section).toBe('prayer'));
    first.unmount();

    renderContent(<QuranPrayerTab />, t.services);
    expect(await screen.findByText(msg('en', 'prayer.noCity.title'))).toBeTruthy();
    expect(screen.queryByTestId('surah-row-1')).toBeNull();
  });

  it('remembers the chosen city and the calendar view', async () => {
    const t = createTestServices({ now: AT_17_00 });
    await t.services.viewState.update({ section: 'prayer' });
    const first = renderContent(<QuranPrayerTab />, t.services);
    fireEvent.click(await screen.findByRole('button', { name: msg('en', 'prayer.noCity.action') }));
    fireEvent.click(await screen.findByTestId('city-peshawar'));
    expect(await screen.findByTestId('today-times')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: msg('en', 'prayer.view.month') }));
    await waitFor(async () => {
      expect(await t.services.viewState.load()).toMatchObject({
        placeId: 'peshawar',
        calendarView: 'month',
      });
    });
    first.unmount();

    renderContent(<QuranPrayerTab />, t.services);
    expect((await screen.findByTestId('prayer-city')).textContent).toBe('Peshawar');
    expect(screen.getByTestId('day-2026-10-31')).toBeTruthy();
  });

  it('opens a surah from the list and comes back to it', async () => {
    const t = createTestServices();
    renderContent(<QuranPrayerTab />, t.services);
    fireEvent.click(await screen.findByTestId('surah-row-3'));
    expect(await screen.findByTestId('arabic-3-1')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: msg('en', 'ui.back') }));
    expect(await screen.findByTestId('surah-row-3')).toBeTruthy();
    expect(screen.queryByTestId('arabic-3-1')).toBeNull();
  });

  it('can open the reader straight away, for a link', async () => {
    const t = createTestServices();
    renderContent(
      <QuranPrayerTab initialReader={{ kind: 'surah', id: 36, ayah: 5 }} />,
      t.services,
    );
    expect(await screen.findByTestId('arabic-36-5')).toBeTruthy();
  });

  it('opens a bookmark at its ayah', async () => {
    const t = createTestServices();
    await t.services.bookmarks.toggleAyah({ surah: 36, ayah: 7 });
    renderContent(<QuranPrayerTab />, t.services);
    fireEvent.click(await screen.findByRole('tab', { name: msg('en', 'quran.tab.saved') }));
    fireEvent.click(await screen.findByRole('button', { name: 'Ya-Sin, ayah 7' }));
    expect(await screen.findByTestId('verse-36-7')).toBeTruthy();
  });
});
