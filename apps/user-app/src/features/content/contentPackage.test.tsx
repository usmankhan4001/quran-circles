import {
  PAKISTAN_CITIES,
  createContentServices,
  createMemoryStorage,
  createViewStateStore,
} from '@qc/content';
import { fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { messages } from '@qc/i18n';
import { within } from '@testing-library/react';
import { MATRIX, NOW, createWorld, directionOf, renderScreen, waitFor } from '../../test/harness';
import { pakistanDate, resolveDailyAyah } from '@qc/contracts';
import { fixtures } from '@qc/contracts/fixtures';
import { CITY_RAWALPINDI } from '../../test/factories';
import { HomeScreen } from '../../screens/HomeScreen';
import { QuranPrayerScreen } from '../../screens/QuranPrayerScreen';
import { createContentModules } from './contentPackage';
import type { ReadingMark } from './modules';

const en = messages.en;
const ur = messages.ur;

/** The mock server's ayah of the day for a visitor who follows nothing (`ayah_of_the_day` is on). */
function dailyAyah() {
  return resolveDailyAyah({ date: pakistanDate(NOW), picks: fixtures.dailyAyahs });
}

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
  return {
    code: 200,
    status: 'OK',
    data: [edition('arabic'), edition('urdu'), edition('english')],
  };
}

/** The same made-up words for one ayah, in the shape of the single-ayah answer. */
function ayahAnswer(surah: number, ayah: number) {
  const one = (label: string) => ({
    number: surah * 1000 + ayah,
    numberInSurah: ayah,
    text: `${label} placeholder ${ayah}`,
    surah: { number: surah },
  });
  return { code: 200, status: 'OK', data: [one('arabic'), one('urdu'), one('english')] };
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

  it('shows the prayer strip on Home with no times until a city is chosen, and opens the tab from it', async () => {
    const { content } = modules();
    const view = await renderScreen(<HomeScreen />, { content });
    const strip = await view.findByTestId('home-prayer-strip', {}, { timeout: 4000 });
    // As drawn, the five prayers stay; the times read "--:--" and the strip asks for a city.
    expect(within(strip).getAllByRole('listitem')).toHaveLength(5);
    expect(strip.textContent).toContain('--:--');
    expect(strip.getAttribute('aria-label')).toContain(en['prayer.noCity.title']);
    fireEvent.click(strip);
    expect(view.world.nav.last()).toEqual({ type: 'tab', route: { name: 'quran' } });
  });

  it('shows the Quran & Prayer tab under one title: the app header', async () => {
    const { content } = modules();
    const view = await renderScreen(<QuranPrayerScreen />, { content });
    await view.findByTestId('section-switch');
    expect(view.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(view.getByRole('heading', { level: 1 }).textContent).toBe(en['quran.hub.title']);
  });

  it('uses the city chosen for the app when no city was chosen in the prayer view', async () => {
    const storage = createMemoryStorage();
    await createViewStateStore(storage).update({ section: 'prayer' });
    const { content } = modules(storage);
    const view = await renderScreen(<QuranPrayerScreen />, { content, cityId: CITY_RAWALPINDI.id });
    await waitFor(() => expect(view.getAllByText(en['prayer.fajr']).length).toBeGreaterThan(0));
    expect(view.queryByTestId('no-city')).toBeNull();
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
    "shows the Arabic of the ayah of the day and the translation in the screen's language (%s)",
    async (locale) => {
      const place = dailyAyah();
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
      // Urdu on an Urdu screen, English on an English screen, never the other language.
      expect(view.getByTestId('home-ayah-translation').textContent).toBe(
        `${locale === 'ur' ? 'urdu' : 'english'} placeholder ${place.ayah}`,
      );
    },
  );

  it('shows the Arabic alone on an English screen when the source has no English', async () => {
    const place = dailyAyah();
    const answer = ayahAnswer(place.surah, place.ayah);
    const content = createContentModules({
      storage: createMemoryStorage(),
      fetch: async () =>
        new Response(JSON.stringify({ ...answer, data: answer.data.slice(0, 2) }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      getApi: () => null,
    });
    const view = await renderScreen(<HomeScreen />, { content, locale: 'en' });
    await view.findByTestId('home-ayah-arabic');
    expect(view.queryByTestId('home-ayah-translation')).toBeNull();
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

  it('tells the app each time the reader saves the place reached, for days read', async () => {
    const options = {
      storage: createMemoryStorage(),
      fetch: async () => new Response('{}', { status: 503 }),
      getApi: () => null,
      now: () => NOW,
    };
    const services = createContentServices(options);
    const content = createContentModules(options, services);
    const marks: ReadingMark[] = [];
    const stop = content.subscribeReading!((mark) => marks.push(mark));
    await services.readingPosition.save(18, 10);
    await waitFor(() => expect(marks).toEqual([{ surah: 18, ayah: 10, at: NOW.toISOString() }]));
    stop();
    await services.readingPosition.save(18, 11);
    await new Promise((r) => setTimeout(r, 20));
    expect(marks).toHaveLength(1);
  });
});
