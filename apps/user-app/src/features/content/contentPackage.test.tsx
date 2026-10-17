import { PAKISTAN_CITIES, createMemoryStorage, createViewStateStore } from '@qc/content';
import { fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { messages } from '@qc/i18n';
import { within } from '@testing-library/react';
import { MATRIX, NOW, createWorld, directionOf, renderScreen, waitFor } from '../../test/harness';
import { ayahOfTheDay } from '../home/ayah';
import { HomeScreen } from '../../screens/HomeScreen';
import { QuranPrayerScreen } from '../../screens/QuranPrayerScreen';
import { createContentModules } from './contentPackage';

const en = messages.en;
const ur = messages.ur;

/**
 * A made-up answer in the shape of the online source, with placeholder words: tests never hold
 * Quran text. The Arabic edition comes first, then the Urdu one.
 */
function sourceAnswer(surah: number, ayahs: number) {
  const edition = (label: string) => ({
    ayahs: Array.from({ length: ayahs }, (_, i) => ({
      number: surah * 1000 + i + 1,
      numberInSurah: i + 1,
      text: `${label} placeholder ${i + 1}`,
    })),
  });
  return { code: 200, status: 'OK', data: [edition('arabic'), edition('urdu')] };
}

/** The same made-up words for one ayah, in the shape of the single-ayah answer. */
function ayahAnswer(surah: number, ayah: number) {
  const one = (label: string) => ({
    number: surah * 1000 + ayah,
    numberInSurah: ayah,
    text: `${label} placeholder ${ayah}`,
    surah: { number: surah },
  });
  return { code: 200, status: 'OK', data: [one('arabic'), one('urdu')] };
}

/** The real package with in-memory storage and no network: the Quran text is never asked for. */
function modules(storage = createMemoryStorage()) {
  const requests: string[] = [];
  const content = createContentModules({
    storage,
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

  it('shows the Quran & Prayer tab under one title: the app header', async () => {
    const { content } = modules();
    const view = await renderScreen(<QuranPrayerScreen />, { content });
    await view.findByTestId('section-switch');
    expect(view.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(view.getByRole('heading', { level: 1 }).textContent).toBe(en['tabs.quranPrayer']);
  });

  it("shows today's five prayers in the strip on Home once a city is chosen", async () => {
    const storage = createMemoryStorage();
    await createViewStateStore(storage).update({ placeId: PAKISTAN_CITIES[0]!.id });
    const { content } = modules(storage);
    const view = await renderScreen(<HomeScreen />, { content });
    const strip = await view.findByTestId('home-prayer-strip', {}, { timeout: 4000 });
    expect(within(strip).getAllByRole('listitem')).toHaveLength(5);
    expect(strip.textContent).toContain(en['prayer.fajr']);
    expect(strip.textContent).toContain(en['prayer.isha']);
  });

  it('keeps just the reference on the ayah card when the Quran text cannot be fetched', async () => {
    const { content, requests } = modules();
    const view = await renderScreen(<HomeScreen />, { content });
    await view.findByTestId('home-ayah');
    await waitFor(() => expect(requests.some((r) => r.includes('alquran.cloud'))).toBe(true));
    expect(view.queryByTestId('home-ayah-arabic')).toBeNull();
    expect(view.getByTestId('home-ayah-read')).toBeTruthy();
  });

  it.each(['en', 'ur'] as const)(
    'shows the Arabic of the ayah of the day, and the Urdu translation only on an Urdu screen (%s)',
    async (locale) => {
      const place = ayahOfTheDay(NOW);
      const content = createContentModules({
        storage: createMemoryStorage(),
        // Home asks for the one ayah; the reader would ask for the whole surah.
        fetch: async (input) =>
          new Response(
            JSON.stringify(
              String(input).includes('/ayah/')
                ? ayahAnswer(place.surah, place.ayah)
                : sourceAnswer(place.surah, place.ayah + 2),
            ),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
        getApi: () => null,
      });
      const view = await renderScreen(<HomeScreen />, { content, locale });
      const arabic = await view.findByTestId('home-ayah-arabic');
      expect(arabic.textContent).toBe(`arabic placeholder ${place.ayah}`);
      if (locale === 'ur') {
        expect(view.getByTestId('home-ayah-translation').textContent).toBe(
          `urdu placeholder ${place.ayah}`,
        );
      } else {
        // There is no English translation source, so English shows the Arabic alone.
        expect(view.queryByTestId('home-ayah-translation')).toBeNull();
      }
    },
  );

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
