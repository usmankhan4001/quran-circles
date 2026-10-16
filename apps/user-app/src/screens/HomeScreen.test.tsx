import { fireEvent } from '@testing-library/react';
import { fixtures } from '@qc/contracts/fixtures';
import { Pressable, Text } from 'react-native';
import { describe, expect, it } from 'vitest';
import { messages } from '@qc/i18n';
import { CITY_RAWALPINDI, SESSIONS, registrationFor } from '../test/factories';
import { MATRIX, NOW, createWorld, directionOf, renderScreen, waitFor } from '../test/harness';
import { HomeScreen } from './HomeScreen';

const en = messages.en;
const ur = messages.ur;

function configFor(seasonMode: string) {
  return {
    'config.get': () => ({
      seasonMode,
      hijriOffsetDays: 0,
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
      const words = locale === 'ur' ? ur : en;
      expect(view.getByText(words['home.updates.title'])).toBeTruthy();
      expect(view.getByText(words['home.season.doraTitle'])).toBeTruthy();
    });
  });
});
