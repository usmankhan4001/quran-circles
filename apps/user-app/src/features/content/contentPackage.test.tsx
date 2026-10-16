import { createMemoryStorage } from '@qc/content';
import { fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { messages } from '@qc/i18n';
import { MATRIX, createWorld, directionOf, renderScreen, waitFor } from '../../test/harness';
import { HomeScreen } from '../../screens/HomeScreen';
import { QuranPrayerScreen } from '../../screens/QuranPrayerScreen';
import { createContentModules } from './contentPackage';

const en = messages.en;
const ur = messages.ur;

/** The real package with in-memory storage and no network: the Quran text is never asked for. */
function modules() {
  const requests: string[] = [];
  const content = createContentModules({
    storage: createMemoryStorage(),
    fetch: async (input) => {
      requests.push(String(input));
      return new Response('{}', { status: 503 });
    },
    getApi: () => null,
  });
  return { content, requests };
}

describe('the Quran & Prayer package inside the app', () => {
  it('shows the tab with the Quran and Prayer switch, under the app header', async () => {
    const { content } = modules();
    const view = await renderScreen(<QuranPrayerScreen />, { content });
    expect(await view.findByTestId('section-switch')).toBeTruthy();
    expect(view.getByTestId('quran-screen')).toBeTruthy();
    expect(view.queryByTestId('quran-unavailable')).toBeNull();
  });

  it('shows the prayer card on Home asking for a city, and opens the tab from it', async () => {
    const { content } = modules();
    const view = await renderScreen(<HomeScreen />, { content });
    fireEvent.click(await view.findByText(en['prayer.noCity.title']));
    expect(view.world.nav.last()).toEqual({ type: 'tab', route: { name: 'quran' } });
  });

  it('invites a first read from Home, and opens the reader on the first surah', async () => {
    const { content } = modules();
    const view = await renderScreen(<HomeScreen />, { content });
    fireEvent.click(await view.findByText(en['home.reading.start']));
    const route = view.world.nav.last();
    expect(route).toMatchObject({
      type: 'tab',
      route: { name: 'quran', reader: { surah: 1, ayah: 1 } },
    });
  });

  it('is given whether someone is signed in and the Hijri offset from the server', async () => {
    const seen: { signedIn: boolean; hijriOffsetDays: number }[] = [];
    const world = await createWorld({
      signedIn: true,
      content: {
        Provider: ({ signedIn, hijriOffsetDays, children }) => {
          seen.push({ signedIn, hijriOffsetDays });
          return <>{children}</>;
        },
      },
      mock: {
        handlers: {
          'config.get': () => ({
            seasonMode: 'dora',
            hijriOffsetDays: -1,
            featureFlags: {
              circle_requests: false,
              session_companion: false,
              invite_friends: false,
              poster_sharing: false,
              quran_offline_copy: false,
              whatsapp_fallback_reminders: false,
            },
            supportedLocales: ['en', 'ur'],
            minimumAppVersion: { ios: '1.0.0', android: '1.0.0' },
            serverTime: '2027-02-15T08:00:00Z',
          }),
        },
      },
    });
    await renderScreen(<QuranPrayerScreen />, { world });
    await waitFor(() => expect(seen.at(-1)).toEqual({ signedIn: true, hijriOffsetDays: -1 }));
  });

  describe.each(MATRIX)('in $name', ({ locale, color, textSize }) => {
    it('draws the tab', async () => {
      const { content } = modules();
      const view = await renderScreen(<QuranPrayerScreen />, { content, locale, color, textSize });
      await view.findByTestId('section-switch');
      expect(directionOf(view.container)).toBe(locale === 'ur' ? 'rtl' : 'ltr');
      expect(
        view.getAllByText((locale === 'ur' ? ur : en)['quran.tab.quran']).length,
      ).toBeGreaterThan(0);
    });
  });
});
