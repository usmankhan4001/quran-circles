import { fireEvent, within } from '@testing-library/react';
import { fixtures } from '@qc/contracts/fixtures';
import { describe, expect, it } from 'vitest';
import { messages } from '@qc/i18n';
import { AREA_SADDAR, CITY_RAWALPINDI, SESSIONS, registrationFor } from '../test/factories';
import { MATRIX, NOW, createWorld, directionOf, renderScreen, waitFor } from '../test/harness';
import { ayahOfTheDay } from '../features/home/ayah';
import { armStartFrameDeferral } from '../ui/startFrame';
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
  it('greets a visitor without a name, and a person by name', async () => {
    const visitor = await renderScreen(<HomeScreen />, { cityId: CITY_RAWALPINDI.id });
    expect(visitor.getByRole('heading', { level: 1 }).textContent).toBe(en['home.greetingGuest']);
    visitor.unmount();
    const world = await createWorld({ signedIn: true, cityId: CITY_RAWALPINDI.id });
    const person = await renderScreen(<HomeScreen />, { world });
    await waitFor(() =>
      expect(person.getByRole('heading', { level: 1 }).textContent).toBe(
        en['home.greeting'].replace('{name}', world.services.auth.getState().me!.displayName!),
      ),
    );
  });

  it('shows the next session near the person on a flat card, and opens it', async () => {
    const world = await createWorld({
      cityId: CITY_RAWALPINDI.id,
      mock: { handlers: configFor('dora') },
    });
    const view = await renderScreen(<HomeScreen />, { world });
    expect(await view.findByText(en['home.nextSession.title'])).toBeTruthy();
    const card = await view.findByTestId('home-lead-card');
    fireEvent.click(card);
    expect(world.nav.last()).toMatchObject({ type: 'go', route: { name: 'session' } });
    expect(world.http.callsTo('GET /v1/occurrences')[0]!.search).toContain(
      `cityId=${CITY_RAWALPINDI.id}`,
    );
  });

  it('offers the join pledge on the card, not a seat', async () => {
    const world = await createWorld({ cityId: CITY_RAWALPINDI.id });
    const view = await renderScreen(<HomeScreen />, { world });
    const join = await view.findByTestId('home-lead-join');
    expect(join.textContent).toContain(en['registration.pledge']);
    fireEvent.click(join);
    expect(world.nav.last()).toMatchObject({ type: 'go', route: { name: 'register' } });
  });

  it('shows the start time, the day with a countdown and directions', async () => {
    const view = await renderScreen(<HomeScreen />, { cityId: CITY_RAWALPINDI.id });
    await view.findByTestId('home-lead-card');
    expect(view.getByTestId('home-lead-clock').textContent).toMatch(/\d/);
    expect(view.getByTestId('home-lead-countdown').textContent).not.toBe('');
    expect(view.getByTestId('home-lead-directions').getAttribute('aria-label')).toBe(
      en['home.next.directions'],
    );
    fireEvent.click(view.getByTestId('home-lead-directions'));
    await waitFor(() => expect(view.world.opened.length).toBe(1));
  });

  it('lists the other circles this week as rows with their start time', async () => {
    const view = await renderScreen(<HomeScreen />, { cityId: CITY_RAWALPINDI.id });
    await view.findByTestId('home-lead-card');
    const list = view.queryByTestId('home-near');
    if (list) {
      const rows = within(list).getAllByRole('button');
      fireEvent.click(rows[0]!);
      expect(view.world.nav.last()).toMatchObject({ type: 'go', route: { name: 'session' } });
    }
    fireEvent.click(view.getByTestId('home-see-all'));
    expect(view.world.nav.last()).toEqual({ type: 'tab', route: { name: 'nearby' } });
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

  it('keeps updates behind the bell, with no feed on Home', async () => {
    const view = await renderScreen(<HomeScreen />, { cityId: CITY_RAWALPINDI.id });
    fireEvent.click(await view.findByTestId('home-bell'));
    expect(view.world.nav.last()).toEqual({ type: 'go', route: { name: 'updates' } });
    expect(view.world.http.callsTo('GET /v1/updates')).toHaveLength(0);
    expect(view.getByTestId('home-bell').getAttribute('aria-label')).toBe(en['updates.title']);
  });

  it('shows the unread count on the bell, with a dot, when signed in', async () => {
    const world = await createWorld({ signedIn: true, cityId: CITY_RAWALPINDI.id });
    const view = await renderScreen(<HomeScreen />, { world });
    const unread = fixtures.updates.filter((u) => !u.isRead).length;
    await waitFor(() =>
      expect(view.getByTestId('home-bell').getAttribute('aria-label')).toBe(
        `${en['updates.title']}, ${en['ui.unread'].replace('{count}', String(unread))}`,
      ),
    );
    expect(view.getByTestId('home-bell-dot')).toBeTruthy();
  });

  it('opens Profile from the avatar when signed in, and Welcome when not', async () => {
    const world = await createWorld({ signedIn: true, cityId: CITY_RAWALPINDI.id });
    const person = await renderScreen(<HomeScreen />, { world });
    await waitFor(() => expect(world.services.auth.getState().me).not.toBeNull());
    fireEvent.click(person.getByTestId('home-profile'));
    expect(world.nav.last()).toEqual({ type: 'go', route: { name: 'profile' } });
    person.unmount();
    const visitor = await renderScreen(<HomeScreen />, { cityId: CITY_RAWALPINDI.id });
    fireEvent.click(visitor.getByTestId('home-profile'));
    expect(visitor.world.nav.last()).toEqual({ type: 'go', route: { name: 'welcome' } });
  });

  it('changes city and area from the area line above the greeting', async () => {
    const view = await renderScreen(<HomeScreen />, { cityId: CITY_RAWALPINDI.id });
    const trigger = view.getByTestId('home-area');
    expect(trigger.getAttribute('aria-label')).toContain(CITY_RAWALPINDI.name.en);
    fireEvent.click(trigger);
    expect(await view.findByTestId(`area-city-${CITY_RAWALPINDI.id}`)).toBeTruthy();
    fireEvent.click(await view.findByTestId(`area-option-${AREA_SADDAR.id}`));
    await waitFor(() => expect(view.world.services.preferences.get().areaId).toBe(AREA_SADDAR.id));
    await waitFor(() =>
      expect(view.getByTestId('home-area').getAttribute('aria-label')).toContain(
        AREA_SADDAR.name.en,
      ),
    );
  });

  it('puts the session the person joined first', async () => {
    const reg = registrationFor(SESSIONS.circle);
    const world = await createWorld({
      signedIn: true,
      cityId: CITY_RAWALPINDI.id,
      mock: { handlers: { 'registrations.listMine': () => ({ items: [reg], nextCursor: null }) } },
    });
    const view = await renderScreen(<HomeScreen />, { world });
    expect(await view.findByTestId('home-your-next')).toBeTruthy();
    fireEvent.click(view.getAllByTestId('home-lead-card')[0]!);
    expect(world.nav.last()).toEqual({
      type: 'go',
      route: { name: 'session', sessionId: SESSIONS.circle.id },
    });
  });

  it('shows only the reference on the ayah card when there are no words to show', async () => {
    const view = await renderScreen(<HomeScreen />, {
      cityId: CITY_RAWALPINDI.id,
      mock: { handlers: configFor('dora') },
    });
    const ayah = await view.findByTestId('home-ayah');
    await waitFor(() => expect(within(ayah).queryByTestId('home-ayah-read')).toBeTruthy());
    const place = ayahOfTheDay(NOW);
    expect(
      within(ayah).getByText(
        en['home.ayah.reference']
          .replace('{surah}', String(place.surah))
          .replace('{ayah}', String(place.ayah)),
      ),
    ).toBeTruthy();
    fireEvent.click(within(ayah).getByTestId('home-ayah-read'));
    expect(view.world.nav.last()).toEqual({
      type: 'tab',
      route: { name: 'quran', reader: { ...place, at: NOW.getTime() } },
    });
  });

  describe.each(MATRIX)('in $name', ({ locale, color, textSize }) => {
    it('draws Home on the white page, mirrored in Urdu', async () => {
      const view = await renderScreen(<HomeScreen />, {
        locale,
        color,
        textSize,
        cityId: CITY_RAWALPINDI.id,
      });
      await view.findByTestId('home-lead-card');
      const words = locale === 'ur' ? ur : en;
      expect(directionOf(view.container)).toBe(locale === 'ur' ? 'rtl' : 'ltr');
      expect(view.getByText(words['home.nextSession.title'])).toBeTruthy();
      expect(view.getByText(words['home.greetingGuest'])).toBeTruthy();
    });
  });
});

describe('Home on the web start', () => {
  it('draws the lead with the start data first and what is below the fold a frame later', async () => {
    const world = await createWorld({ cityId: CITY_RAWALPINDI.id });
    armStartFrameDeferral();
    const view = await renderScreen(<HomeScreen />, { world });
    expect(view.queryByTestId('home-ayah')).toBeNull();
    expect(await view.findByTestId('home-ayah')).toBeTruthy();
    expect(view.getAllByTestId('home-lead-card').length).toBeGreaterThan(0);
  });
});
