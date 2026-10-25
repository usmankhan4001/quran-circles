import { fireEvent, within } from '@testing-library/react';
import { FIXTURE_NOW, fixtures } from '@qc/contracts/fixtures';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { messages } from '@qc/i18n';
import { pakistanDate, resolveDailyAyah } from '@qc/contracts';
import {
  AREA_SADDAR,
  CITY_ISLAMABAD,
  CITY_RAWALPINDI,
  SESSIONS,
  followFor,
  registrationFor,
} from '../test/factories';
import { act, createWorld, renderScreen, waitFor } from '../test/harness';
import { HomeScreen } from './HomeScreen';
import { JourneyScreen } from './JourneyScreen';
import { NearbyScreen } from './NearbyScreen';
import { ProfileScreen } from './ProfileScreen';
import { RegistrationScreen } from './RegistrationScreen';
import { SessionScreen } from './SessionScreen';
import { SignInScreen } from './SignInScreen';
import { UpdatesScreen } from './UpdatesScreen';
import { VenueScreen } from './VenueScreen';

const en = messages.en;
const noor = fixtures.venues[0]!;

/** `config.get` with the circle requests flag on only for the cities listed. */
function circleRequestsIn(...cityIds: string[]) {
  return {
    'config.get': (c: { query: Record<string, unknown> }) => ({
      seasonMode: 'dora',
      hijriOffsetDays: 0,
      featureFlags: {
        circle_requests: typeof c.query.cityId === 'string' && cityIds.includes(c.query.cityId),
        session_companion: false,
        invite_friends: false,
        poster_sharing: false,
        quran_offline_copy: false,
        whatsapp_fallback_reminders: false,
      },
      supportedLocales: ['en', 'ur'],
      minimumAppVersion: { ios: '1.0.0', android: '1.0.0' },
      serverTime: FIXTURE_NOW,
    }),
  };
}

describe('Home (H4)', () => {
  it('holds the next circle, then the other circles and the ayah, on the white page', async () => {
    const world = await createWorld({ cityId: CITY_RAWALPINDI.id });
    const view = await renderScreen(<HomeScreen />, { world });
    expect(await view.findByTestId('home-lead-card')).toBeTruthy();
    expect(view.getByTestId('screen-header')).toBeTruthy();
    expect(view.getByTestId('home-ayah')).toBeTruthy();
    // No coloured band, no search field, no map card, no "Also in the app" row.
    expect(view.queryByTestId('home-search')).toBeNull();
    expect(view.queryByTestId('home-map')).toBeNull();
    expect(view.queryByTestId('home-also')).toBeNull();
  });

  it('shows circles near you as rows that open the session', async () => {
    const world = await createWorld({ cityId: CITY_RAWALPINDI.id });
    const view = await renderScreen(<HomeScreen />, { world });
    await view.findByTestId('home-lead-card');
    const pictures = view.getByTestId('home-near');
    const first = pictures.querySelector<HTMLElement>('[data-testid^="home-near-"]');
    expect(first).not.toBeNull();
    fireEvent.click(first!);
    expect(world.nav.last()).toMatchObject({ type: 'go', route: { name: 'session' } });
  });

  it('shows the ayah of the day and opens the reader at its place', async () => {
    const world = await createWorld({ cityId: CITY_RAWALPINDI.id });
    const view = await renderScreen(<HomeScreen />, { world });
    // `ayah_of_the_day` is on in the mock: the server's pick for today.
    const place = resolveDailyAyah({
      date: pakistanDate(world.services.now()),
      picks: fixtures.dailyAyahs,
    });
    expect(
      await view.findByText(
        en['home.ayah.reference']
          .replace('{surah}', String(place.surah))
          .replace('{ayah}', String(place.ayah)),
      ),
    ).toBeTruthy();
    fireEvent.click(view.getByTestId('home-ayah-read'));
    expect(world.nav.last()).toMatchObject({
      type: 'tab',
      route: { name: 'quran', reader: { surah: place.surah, ayah: place.ayah } },
    });
  });

  it('puts a bell in the header that opens Updates and says how many are unread', async () => {
    const world = await createWorld({ signedIn: true, cityId: CITY_RAWALPINDI.id });
    const view = await renderScreen(<HomeScreen />, { world });
    const unread = fixtures.updates.filter((u) => !u.isRead).length;
    await waitFor(() =>
      expect(view.getByTestId('home-bell').getAttribute('aria-label')).toContain(
        en['ui.unread'].replace('{count}', String(unread)),
      ),
    );
    fireEvent.click(view.getByTestId('home-bell'));
    expect(world.nav.last()).toEqual({ type: 'go', route: { name: 'updates' } });
  });

  it('opens Nearby from "See all" next to the circles near you', async () => {
    const world = await createWorld({ cityId: CITY_RAWALPINDI.id });
    const view = await renderScreen(<HomeScreen />, { world });
    fireEvent.click(await view.findByTestId('home-see-all'));
    expect(world.nav.last()).toEqual({ type: 'tab', route: { name: 'nearby' } });
  });
});

describe('Nearby (N2)', () => {
  it('has the title, the search and the List / Map switch in its white header (D17)', async () => {
    const view = await renderScreen(<NearbyScreen />, { cityId: CITY_RAWALPINDI.id });
    const header = await view.findByTestId('screen-header');
    expect(within(header).getByTestId('nearby-search')).toBeTruthy();
    expect(within(header).getByTestId('nearby-view')).toBeTruthy();
    expect(within(header).getByRole('heading', { name: en['nearby.title'] })).toBeTruthy();
  });

  it('ends the list with "Ask for a circle near you" when the flag is on, its action marked coming soon', async () => {
    const view = await renderScreen(<NearbyScreen />, {
      cityId: CITY_RAWALPINDI.id,
      mock: { handlers: circleRequestsIn(CITY_RAWALPINDI.id) },
    });
    const list = await view.findByTestId('nearby-list');
    const ask = await within(list).findByTestId('nearby-ask');
    expect(within(ask).getByText(en['nearby.ask.title'])).toBeTruthy();
    expect(list.lastElementChild).toBe(ask);
    const action = within(ask).getByTestId('nearby-ask-action');
    expect(action.getAttribute('aria-disabled')).toBe('true');
    expect(action.textContent).toContain(en['comingSoon.badge']);
    fireEvent.click(action);
    expect(view.queryByText(en['nearby.request.soon'])).toBeNull();
  });

  it('hides "Ask for a circle near you" while the circle requests flag is off', async () => {
    const world = await createWorld({
      cityId: CITY_RAWALPINDI.id,
      mock: { handlers: circleRequestsIn() },
    });
    const view = await renderScreen(<NearbyScreen />, { world });
    const list = await view.findByTestId('nearby-list');
    await waitFor(() => expect(world.http.callsTo('GET /v1/config').length).toBeGreaterThan(0));
    expect(within(list).getAllByText(SESSIONS.taraweeh.venue.name.en).length).toBeGreaterThan(0);
    expect(view.queryByTestId('nearby-ask')).toBeNull();
    expect(view.queryByText(en['nearby.ask.title'])).toBeNull();
  });

  it('reads the flag for the city being browsed, and follows a change of city', async () => {
    const world = await createWorld({
      cityId: CITY_ISLAMABAD.id,
      mock: { handlers: circleRequestsIn(CITY_RAWALPINDI.id) },
    });
    const view = await renderScreen(<NearbyScreen />, { world });
    await view.findByTestId('nearby-list');
    expect(view.queryByTestId('nearby-ask')).toBeNull();

    await act(() => world.services.preferences.update({ cityId: CITY_RAWALPINDI.id }));
    expect(await view.findByTestId('nearby-ask')).toBeTruthy();
    const searches = world.http.callsTo('GET /v1/config').map((c) => c.search);
    expect(searches.some((q) => q.includes(`cityId=${CITY_ISLAMABAD.id}`))).toBe(true);
    expect(searches.some((q) => q.includes(`cityId=${CITY_RAWALPINDI.id}`))).toBe(true);

    await act(() => world.services.preferences.update({ cityId: CITY_ISLAMABAD.id }));
    await waitFor(() => expect(view.queryByTestId('nearby-ask')).toBeNull());
  });

  it('keeps it hidden when the settings cannot be fetched', async () => {
    const world = await createWorld({ cityId: CITY_RAWALPINDI.id });
    world.http.failNext('GET /v1/config', 'internal_error', 10);
    const view = await renderScreen(<NearbyScreen />, { world });
    await view.findByTestId('nearby-list');
    await waitFor(() => expect(world.http.callsTo('GET /v1/config').length).toBeGreaterThan(0));
    expect(view.queryByTestId('nearby-ask')).toBeNull();
  });

  it('offers to request a circle from the empty list only when the flag is on', async () => {
    const empty = { 'sessions.list': () => ({ items: [], nextCursor: null }) };
    const on = await renderScreen(<NearbyScreen />, {
      cityId: CITY_RAWALPINDI.id,
      mock: { handlers: { ...empty, ...circleRequestsIn(CITY_RAWALPINDI.id) } },
    });
    const withRequest = await on.findByTestId('nearby-empty');
    expect(await within(withRequest).findByText(en['nearby.request.action'])).toBeTruthy();
    on.unmount();

    const world = await createWorld({
      cityId: CITY_RAWALPINDI.id,
      mock: { handlers: { ...empty, ...circleRequestsIn() } },
    });
    const off = await renderScreen(<NearbyScreen />, { world });
    const withoutRequest = await off.findByTestId('nearby-empty');
    await waitFor(() => expect(world.http.callsTo('GET /v1/config').length).toBeGreaterThan(0));
    expect(within(withoutRequest).queryByText(en['nearby.request.action'])).toBeNull();
  });

  it('selects a place on the map and shows its card with Join and Details', async () => {
    const view = await renderScreen(<NearbyScreen />, { cityId: CITY_RAWALPINDI.id });
    await view.findByTestId('nearby-list');
    fireEvent.click(within(view.getByTestId('nearby-view')).getByText(en['nearby.view.map']));
    fireEvent.click(await view.findByTestId(`map-marker-${SESSIONS.taraweeh.venueId}`));
    expect(await view.findByTestId('map-selection')).toBeTruthy();
    expect(view.getByTestId(`map-open-${SESSIONS.taraweeh.id}`)).toBeTruthy();
  });
});

describe('Session and venue (S1)', () => {
  it('has the time, who it is for, and one Join button', async () => {
    const view = await renderScreen(<SessionScreen sessionId={SESSIONS.taraweeh.id} />);
    expect(await view.findByTestId('session-time')).toBeTruthy();
    expect(await view.findByTestId('register-button')).toBeTruthy();
    expect(view.getAllByTestId('register-button')).toHaveLength(1);
    expect(view.getAllByText(en['sections.family']).length).toBeGreaterThan(0);
  });

  it('has the map card on the venue page', async () => {
    const view = await renderScreen(<VenueScreen venueId={noor.id} />);
    expect(await view.findByTestId('venue-map-card')).toBeTruthy();
  });
});

describe('Session and venue top (S1)', () => {
  afterEach(() => {
    Reflect.deleteProperty(window.navigator, 'share');
  });

  it('has a back button and a share button in the plain top bar, and no photo', async () => {
    const view = await renderScreen(<SessionScreen sessionId={SESSIONS.taraweeh.id} />);
    expect(await view.findByTestId('screen-share')).toBeTruthy();
    expect(view.getByLabelText(en['ui.back'])).toBeTruthy();
    expect(view.queryByTestId('session-photo')).toBeNull();
  });

  it('shares the session with its venue and time through the system share', async () => {
    const share = vi.fn(async () => undefined);
    Object.defineProperty(window.navigator, 'share', { value: share, configurable: true });
    const view = await renderScreen(<SessionScreen sessionId={SESSIONS.taraweeh.id} />);
    fireEvent.click(await view.findByTestId('screen-share'));
    await waitFor(() => expect(share).toHaveBeenCalledOnce());
    const sent = (share.mock.calls[0] as unknown as [{ text: string }])[0].text;
    expect(sent).toContain(SESSIONS.taraweeh.title.en);
    expect(sent).toContain(SESSIONS.taraweeh.venue.name.en);
    expect(sent).toContain('https://www.google.com/maps/search/');
  });

  it('says so when the device cannot share', async () => {
    const view = await renderScreen(<SessionScreen sessionId={SESSIONS.taraweeh.id} />);
    fireEvent.click(await view.findByTestId('screen-share'));
    expect(await view.findByText(en['session.share.unavailable'])).toBeTruthy();
  });

  it('shares a venue too', async () => {
    const share = vi.fn(async () => undefined);
    Object.defineProperty(window.navigator, 'share', { value: share, configurable: true });
    const view = await renderScreen(<VenueScreen venueId={noor.id} />);
    fireEvent.click(await view.findByTestId('screen-share'));
    await waitFor(() => expect(share).toHaveBeenCalledOnce());
    const sent = (share.mock.calls[0] as unknown as [{ text: string }])[0].text;
    expect(sent).toContain(noor.name.en);
  });
});

describe('Registration (R2)', () => {
  async function open(session = SESSIONS.taraweeh) {
    const world = await createWorld({ signedIn: true, cityId: CITY_RAWALPINDI.id });
    const view = await renderScreen(<RegistrationScreen sessionId={session.id} />, { world });
    await view.findByTestId('registration-form');
    return { world, view };
  }

  it('opens with a back button, the session on the page and the pledge sheet under it', async () => {
    const { world, view } = await open();
    expect(view.getByTestId('registration-summary').textContent).toContain(
      SESSIONS.taraweeh.venue.name.en,
    );
    expect(view.getByText(en['join.noSeat'])).toBeTruthy();
    fireEvent.click(view.getByTestId('page-back'));
    expect(world.nav.last()).toEqual({ type: 'back' });
  });

  it.each(['women', 'men', 'family'] as const)(
    'offers %s on a family session, and sends the choice',
    async (section) => {
      const { world, view } = await open();
      for (const s of ['women', 'men', 'family']) {
        expect(view.getByTestId(`registration-section-${s}`)).toBeTruthy();
      }
      fireEvent.click(view.getByTestId('registration-area'));
      fireEvent.click(await view.findByTestId(`area-option-${AREA_SADDAR.id}`));
      fireEvent.click(view.getByTestId(`registration-section-${section}`));
      expect(view.getByTestId(`registration-section-${section}`).getAttribute('aria-checked')).toBe(
        'true',
      );
      fireEvent.click(view.getByTestId('registration-submit'));
      await waitFor(() => expect(world.http.callsTo('POST /v1/registrations')).toHaveLength(1));
      expect(world.http.callsTo('POST /v1/registrations')[0]!.body).toMatchObject({ section });
    },
  );

  it('shows no section choice for a women-only session, only the fixed one', async () => {
    const { view } = await open(SESSIONS.womenFull);
    expect(view.queryByTestId('registration-section-men')).toBeNull();
    expect(view.getByTestId('registration-section-fixed')).toBeTruthy();
  });

  it('has no seat count: joining sends one person, with no stepper on the form', async () => {
    const { world, view } = await open();
    expect(view.queryByTestId('registration-party')).toBeNull();
    fireEvent.click(view.getByTestId('registration-area'));
    fireEvent.click(await view.findByTestId(`area-option-${AREA_SADDAR.id}`));
    fireEvent.click(view.getByTestId('registration-section-family'));
    fireEvent.click(view.getByTestId('registration-submit'));
    await waitFor(() => expect(world.http.callsTo('POST /v1/registrations')).toHaveLength(1));
    expect(world.http.callsTo('POST /v1/registrations')[0]!.body).toMatchObject({ partySize: 1 });
  });

  it('starts with no section chosen on a family session, and asks for one', async () => {
    const { view } = await open();
    for (const s of ['women', 'men', 'family']) {
      expect(view.getByTestId(`registration-section-${s}`).getAttribute('aria-checked')).toBe(
        'false',
      );
    }
    fireEvent.click(view.getByTestId('registration-submit'));
    expect(await view.findByText(en['registration.problem.section'])).toBeTruthy();
  });
});

describe('My Journey (J1)', () => {
  it('shows each registration as a pass with its status, and the count of follows (D17)', async () => {
    const waitlisted = registrationFor(SESSIONS.womenFull, {
      id: '00000000-0000-4000-8000-0b0000000002',
      status: 'waitlisted',
      waitlistPosition: 1,
    });
    const world = await createWorld({
      signedIn: true,
      mock: {
        handlers: {
          'registrations.listMine': () => ({
            items: [registrationFor(SESSIONS.taraweeh), waitlisted],
            nextCursor: null,
          }),
          'follows.list': () => ({ items: [followFor(noor)] }),
        },
      },
    });
    const view = await renderScreen(<JourneyScreen />, { world });
    await waitFor(() => expect(view.getByTestId('journey-follow-count').textContent).toBe('1'));
    expect(
      view.getByTestId(`registration-status-${registrationFor(SESSIONS.taraweeh).id}`).textContent,
    ).toBe(en['journey.status.confirmed']);
    expect(view.getByTestId(`registration-status-${waitlisted.id}`).textContent).toBe(
      en['journey.status.waitlisted'],
    );
  });

  it('shows no follow count to a signed-out person', async () => {
    const view = await renderScreen(<JourneyScreen />);
    expect(view.queryByTestId('journey-follow-count')).toBeNull();
  });
});

describe('Profile, Updates and Sign-in (B)', () => {
  it('opens the profile on white with quick tiles as cards under the account (D17)', async () => {
    const world = await createWorld({ signedIn: true });
    const view = await renderScreen(<ProfileScreen />, { world });
    const header = view.getByTestId('screen-header');
    expect(within(header).queryByTestId('profile-tiles')).toBeNull();
    expect(view.getByTestId('profile-tiles')).toBeTruthy();
    fireEvent.click(view.getByTestId('profile-tile-journey'));
    expect(world.nav.last()).toEqual({ type: 'tab', route: { name: 'journey' } });
    fireEvent.click(view.getByTestId('profile-tile-updates'));
    expect(world.nav.last()).toEqual({ type: 'go', route: { name: 'updates' } });
    fireEvent.click(view.getByTestId('profile-tile-help'));
    expect(world.nav.last()).toEqual({ type: 'go', route: { name: 'page', slug: 'faq' } });
  });

  it('shows each update as a card that opens its session', async () => {
    const world = await createWorld({ signedIn: true });
    const view = await renderScreen(<UpdatesScreen />, { world });
    const withSession = fixtures.updates.find((u) => u.sessionId)!;
    const card = await view.findByTestId(`update-${withSession.id}`);
    expect(card.getAttribute('role')).toBe('button');
    fireEvent.click(card);
    expect(world.nav.last()).toEqual({
      type: 'go',
      route: { name: 'session', sessionId: withSession.sessionId },
    });
  });

  it('marks each update with a picture of its kind, and says "Go to session" when it has one', async () => {
    const world = await createWorld({ signedIn: true });
    const view = await renderScreen(<UpdatesScreen />, { world });
    for (const update of fixtures.updates) {
      expect(await view.findByTestId(`update-${update.id}-kind`)).toBeTruthy();
      const card = view.getByTestId(`update-${update.id}`);
      if (update.sessionId) {
        expect(view.getByTestId(`update-${update.id}-open`).textContent).toBe(
          en['updates.goToSession'],
        );
        expect(card.getAttribute('aria-label')).toContain(en['updates.goToSession']);
      } else {
        expect(view.queryByTestId(`update-${update.id}-open`)).toBeNull();
      }
    }
  });

  it('opens sign-in on white with a back button and a big heading (D17)', async () => {
    const view = await renderScreen(<SignInScreen />);
    expect(view.getByLabelText(en['ui.back'])).toBeTruthy();
    expect(view.getByRole('heading', { level: 1 }).textContent).toBe(en['signIn.welcomeBack']);
  });

  it('takes the sign-in code in boxed cells and accepts digits only', async () => {
    const view = await renderScreen(<SignInScreen />);
    fireEvent.change(view.getByTestId('phone-input'), { target: { value: '03001234567' } });
    fireEvent.click(view.getByTestId('send-code'));
    const code = await view.findByTestId('code-input');
    fireEvent.change(code, { target: { value: '12a3b4' } });
    expect((code as HTMLInputElement).value).toBe('1234');
  });
});
