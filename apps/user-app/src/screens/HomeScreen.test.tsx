import { fireEvent, within } from '@testing-library/react';
import { fixtures } from '@qc/contracts/fixtures';
import { Pressable, Text } from 'react-native';
import { describe, expect, it } from 'vitest';
import { messages } from '@qc/i18n';
import {
  AREA_SADDAR,
  CITY_RAWALPINDI,
  SESSIONS,
  occurrencesOf,
  registrationFor,
} from '../test/factories';
import {
  MATRIX,
  NOW,
  act,
  createWorld,
  directionOf,
  expectGreenHeader,
  renderScreen,
  waitFor,
} from '../test/harness';
import { HomeScreen } from './HomeScreen';

const en = messages.en;
const ur = messages.ur;

function configFor(seasonMode: string, hijriOffsetDays = 0) {
  return {
    'config.get': () => ({
      seasonMode,
      hijriOffsetDays,
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
  };
}

describe('HomeScreen', () => {
  it('leads with Dora in the Dora season and shows the next session near the person', async () => {
    const world = await createWorld({
      cityId: CITY_RAWALPINDI.id,
      mock: { handlers: configFor('dora') },
    });
    const view = await renderScreen(<HomeScreen />, { world });
    expect(await view.findByText(en['home.season.doraTitle'])).toBeTruthy();
    const card = await view.findByTestId('home-lead-card');
    fireEvent.click(card);
    expect(world.nav.last()?.type).toBe('go');
    expect(world.nav.last()).toMatchObject({ route: { name: 'session' } });
    expect(world.http.callsTo('GET /v1/occurrences')[0]!.search).toContain(
      `cityId=${CITY_RAWALPINDI.id}`,
    );
  });

  it('leads with circles outside the Dora season', async () => {
    const world = await createWorld({
      cityId: CITY_RAWALPINDI.id,
      mock: { handlers: configFor('circles') },
    });
    const view = await renderScreen(<HomeScreen />, { world });
    expect(await view.findByText(en['home.season.circlesTitle'])).toBeTruthy();
  });

  it('asks a person without a city to choose one, and sends them to Nearby', async () => {
    const view = await renderScreen(<HomeScreen />);
    fireEvent.click(await view.findByTestId('home-choose-city'));
    expect(view.world.nav.last()).toEqual({ type: 'tab', route: { name: 'nearby' } });
  });

  it('shows an empty state with a way forward when nothing is coming up', async () => {
    const world = await createWorld({
      cityId: CITY_RAWALPINDI.id,
      mock: { handlers: { 'occurrences.list': () => ({ items: [], nextCursor: null }) } },
    });
    const view = await renderScreen(<HomeScreen />, { world });
    expect(await view.findByTestId('home-lead-empty')).toBeTruthy();
    fireEvent.click(view.getByText(en['home.nextSession.empty.action']));
    expect(world.nav.last()).toEqual({ type: 'tab', route: { name: 'nearby' } });
  });

  it('asks a signed-out person to sign in for updates, and returns here afterwards', async () => {
    const view = await renderScreen(<HomeScreen />, { cityId: CITY_RAWALPINDI.id });
    fireEvent.click(await view.findByTestId('home-sign-in'));
    expect(view.world.nav.last()).toEqual({
      type: 'go',
      route: { name: 'signIn', returnTo: { name: 'home' } },
    });
    expect(view.world.http.callsTo('GET /v1/updates')).toHaveLength(0);
    expect(view.queryByTestId('home-unread')).toBeNull();
  });

  it('shows the updates feed with the unread count when signed in, and opens an update', async () => {
    const world = await createWorld({ signedIn: true, cityId: CITY_RAWALPINDI.id });
    const view = await renderScreen(<HomeScreen />, { world });
    const unread = fixtures.updates.filter((u) => !u.isRead).length;
    await waitFor(() => expect(view.getByTestId('home-unread').textContent).toBe(String(unread)));
    const withSession = fixtures.updates.find((u) => u.sessionId)!;
    fireEvent.click(await view.findByTestId(`update-${withSession.id}`));
    expect(world.nav.last()).toEqual({
      type: 'go',
      route: { name: 'session', sessionId: withSession.sessionId },
    });
    fireEvent.click(view.getByTestId('home-updates-all'));
    expect(world.nav.last()).toEqual({ type: 'go', route: { name: 'updates' } });
  });

  it('puts the session the person registered for first', async () => {
    const reg = registrationFor(SESSIONS.circle);
    const world = await createWorld({
      signedIn: true,
      cityId: CITY_RAWALPINDI.id,
      mock: { handlers: { 'registrations.listMine': () => ({ items: [reg], nextCursor: null }) } },
    });
    const view = await renderScreen(<HomeScreen />, { world });
    expect(await view.findByTestId('home-your-next')).toBeTruthy();
    expect(view.getByText(en['home.nextSession.title'])).toBeTruthy();
    fireEvent.click(view.getAllByTestId('home-lead-card')[0]!);
    expect(world.nav.last()).toEqual({
      type: 'go',
      route: { name: 'session', sessionId: SESSIONS.circle.id },
    });
  });

  it('shows placeholders for prayer and reading until the content package provides cards', async () => {
    const view = await renderScreen(<HomeScreen />, { cityId: CITY_RAWALPINDI.id });
    fireEvent.click(await view.findByTestId('home-prayer-placeholder'));
    expect(view.world.nav.last()).toEqual({ type: 'tab', route: { name: 'quran' } });
    expect(view.getByTestId('home-reading-placeholder')).toBeTruthy();
  });

  it('mounts the content package cards when it provides them', async () => {
    const view = await renderScreen(<HomeScreen />, {
      cityId: CITY_RAWALPINDI.id,
      content: {
        NextPrayerCard: ({ onPress }) => (
          <Pressable onPress={onPress} testID="prayer-card">
            <Text>Next prayer card</Text>
          </Pressable>
        ),
        ContinueReadingCard: ({ onOpen }) => (
          <Pressable onPress={() => onOpen({ surah: 18, ayah: 10 })} testID="reading-card">
            <Text>Continue reading card</Text>
          </Pressable>
        ),
      },
    });
    expect(await view.findByText('Next prayer card')).toBeTruthy();
    expect(view.getByText('Continue reading card')).toBeTruthy();
    expect(view.queryByTestId('home-prayer-placeholder')).toBeNull();
    expect(view.queryByTestId('home-reading-placeholder')).toBeNull();
    fireEvent.click(view.getByTestId('prayer-card'));
    expect(view.world.nav.last()).toEqual({ type: 'tab', route: { name: 'quran' } });
    fireEvent.click(view.getByTestId('reading-card'));
    expect(view.world.nav.last()).toEqual({
      type: 'tab',
      route: { name: 'quran', reader: { surah: 18, ayah: 10, at: NOW.getTime() } },
    });
  });

  describe('Hijri date in the green header', () => {
    // The app clock is fixed at 2027-02-15 13:00 in Pakistan: 8 Ramadan 1448.
    it("shows today's Hijri date above the title", async () => {
      const view = await renderScreen(<HomeScreen />, { cityId: CITY_RAWALPINDI.id });
      const header = await view.findByTestId('screen-header');
      expect(within(header).getByText('8 Ramadan 1448 AH')).toBeTruthy();
    });

    it('moves the date by the offset from config', async () => {
      const world = await createWorld({
        cityId: CITY_RAWALPINDI.id,
        mock: { handlers: configFor('circles', 1) },
      });
      const view = await renderScreen(<HomeScreen />, { world });
      const header = await view.findByTestId('screen-header');
      expect(await within(header).findByText('9 Ramadan 1448 AH')).toBeTruthy();
      expect(within(header).queryByText('8 Ramadan 1448 AH')).toBeNull();
    });

    it('takes a negative offset too', async () => {
      const world = await createWorld({
        cityId: CITY_RAWALPINDI.id,
        mock: { handlers: configFor('circles', -1) },
      });
      const view = await renderScreen(<HomeScreen />, { world });
      const header = await view.findByTestId('screen-header');
      expect(await within(header).findByText('7 Ramadan 1448 AH')).toBeTruthy();
    });

    it('turns the day at midnight in Pakistan', async () => {
      const world = await createWorld({ cityId: CITY_RAWALPINDI.id });
      // 13:00 to 00:30 the next day, Pakistan time.
      world.clock.advance(11.5 * 3600_000);
      const view = await renderScreen(<HomeScreen />, { world });
      const header = await view.findByTestId('screen-header');
      expect(within(header).getByText('9 Ramadan 1448 AH')).toBeTruthy();
    });

    it('writes it in Urdu with the Urdu month name', async () => {
      const view = await renderScreen(<HomeScreen />, {
        cityId: CITY_RAWALPINDI.id,
        locale: 'ur',
      });
      const header = await view.findByTestId('screen-header');
      const expected = ur['home.hijri.date']
        .replace('{day}', '8')
        .replace('{month}', ur['prayer.hijriMonth.9'])
        .replace('{year}', '1448');
      expect(within(header).getByText(expected)).toBeTruthy();
    });
  });

  describe('distance on the map card', () => {
    it('adds the distance to the nearest circle from the chosen area', async () => {
      // Saddar's centre is about 50 m from the sample Masjid Al-Noor.
      const view = await renderScreen(<HomeScreen />, {
        cityId: CITY_RAWALPINDI.id,
        areaId: AREA_SADDAR.id,
      });
      const map = await view.findByTestId('home-map');
      await waitFor(() => expect(map.textContent).toContain('· nearest 50 m'));
      expect(map.textContent).toMatch(/^\d+ circles near you · nearest 50 m/);
    });

    it('writes km with one decimal under 10 km', async () => {
      const venue = SESSIONS.taraweeh.venue;
      // An area centre 0.011 degrees of latitude north of the venue: about 1.2 km away.
      const area = { ...AREA_SADDAR, lat: venue.lat + 0.011, lng: venue.lng };
      const view = await renderScreen(<HomeScreen />, {
        cityId: CITY_RAWALPINDI.id,
        areaId: AREA_SADDAR.id,
        mock: {
          handlers: {
            'places.areas': () => ({ items: [area] }),
            'occurrences.list': () => ({
              items: [{ ...occurrencesOf(SESSIONS.taraweeh)[0]!, session: SESSIONS.taraweeh }],
              nextCursor: null,
            }),
          },
        },
      });
      const map = await view.findByTestId('home-map');
      await waitFor(() => expect(map.textContent).toContain('1 circle near you · nearest 1.2 km'));
    });

    it('keeps the plain count when no area is chosen', async () => {
      const view = await renderScreen(<HomeScreen />, { cityId: CITY_RAWALPINDI.id });
      const map = await view.findByTestId('home-map');
      expect(map.textContent).toMatch(/^\d+ circles near you/);
      expect(map.textContent).not.toContain('nearest');
    });

    it('keeps the plain count when the area has no coordinates', async () => {
      const view = await renderScreen(<HomeScreen />, {
        cityId: CITY_RAWALPINDI.id,
        areaId: AREA_SADDAR.id,
        mock: {
          handlers: {
            'places.areas': () => ({ items: [{ ...AREA_SADDAR, lat: null, lng: null }] }),
          },
        },
      });
      const map = await view.findByTestId('home-map');
      // Let the area list arrive, then check nothing changed.
      await waitFor(() =>
        expect(view.world.http.callsTo('GET /v1/places/areas').length).toBeGreaterThan(0),
      );
      await act(async () => {});
      expect(map.textContent).not.toContain('nearest');
    });

    it('says it in Urdu', async () => {
      const view = await renderScreen(<HomeScreen />, {
        cityId: CITY_RAWALPINDI.id,
        areaId: AREA_SADDAR.id,
        locale: 'ur',
      });
      const map = await view.findByTestId('home-map');
      const distance = ur['home.distance.metres'].replace('{distance}', '50');
      await waitFor(() => expect(map.textContent).toContain(distance));
      expect(map.textContent).toContain(ur['home.map.countNearest.other'].split('{count}')[0]!);
    });
  });

  describe.each(MATRIX)('in $name', ({ locale, color, textSize }) => {
    it('draws Home', async () => {
      const world = await createWorld({
        signedIn: true,
        cityId: CITY_RAWALPINDI.id,
        locale,
        color,
        textSize,
      });
      const view = await renderScreen(<HomeScreen />, { world });
      await view.findByTestId('home-lead-card');
      expect(directionOf(view.container)).toBe(locale === 'ur' ? 'rtl' : 'ltr');
      expectGreenHeader(view.container, color);
      const words = locale === 'ur' ? ur : en;
      // "Updates" is the section title, the bell and a tile of "Also in the app".
      expect(view.getAllByText(words['home.updates.title']).length).toBeGreaterThan(0);
      expect(view.getByText(words['home.season.doraTitle'])).toBeTruthy();
      expect(view.getByText(words['home.also.title'])).toBeTruthy();
      expect(view.getByText(words['home.ayah.title'])).toBeTruthy();
      expect(view.getByTestId('home-search')).toBeTruthy();
    });
  });
});
