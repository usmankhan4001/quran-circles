import { fireEvent, within } from '@testing-library/react';
import { fixtures } from '@qc/contracts/fixtures';
import { describe, expect, it } from 'vitest';
import { messages } from '@qc/i18n';
import {
  AREA_SADDAR,
  CITY_RAWALPINDI,
  SESSIONS,
  followFor,
  registrationFor,
} from '../test/factories';
import { createWorld, renderScreen, waitFor } from '../test/harness';
import { ayahOfTheDay } from '../features/home/ayah';
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

describe('Home (H4)', () => {
  it('holds the next circle in the green header, then search, map, pictures, ayah and the app row', async () => {
    const world = await createWorld({ cityId: CITY_RAWALPINDI.id });
    const view = await renderScreen(<HomeScreen />, { world });
    const header = await view.findByTestId('screen-header');
    expect(within(header).getByTestId('home-lead-card')).toBeTruthy();
    expect(view.getByTestId('home-search')).toBeTruthy();
    expect(await view.findByTestId('home-map')).toBeTruthy();
    expect(view.getByTestId('home-ayah')).toBeTruthy();
    expect(view.getByTestId('home-also')).toBeTruthy();
    expect(view.getByTestId('home-also-quran')).toBeTruthy();
    expect(view.getByTestId('home-also-prayer')).toBeTruthy();
    expect(view.getByTestId('home-also-qibla')).toBeTruthy();
    expect(view.getByTestId('home-also-updates')).toBeTruthy();
  });

  it('opens Nearby from the search field, the filter button and the map card', async () => {
    const world = await createWorld({ cityId: CITY_RAWALPINDI.id });
    const view = await renderScreen(<HomeScreen />, { world });
    for (const id of ['home-search', 'home-filters']) {
      fireEvent.click(view.getByTestId(id));
      expect(world.nav.last()).toEqual({ type: 'tab', route: { name: 'nearby' } });
    }
    fireEvent.click(await view.findByTestId('home-map'));
    expect(world.nav.last()).toEqual({ type: 'tab', route: { name: 'nearby' } });
  });

  it('shows circles near you as picture cards that open the session', async () => {
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
    const place = ayahOfTheDay(world.services.now());
    expect(
      view.getByText(
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

  it('goes to the right place from each tile of "Also in the app"', async () => {
    const world = await createWorld({ cityId: CITY_RAWALPINDI.id });
    const view = await renderScreen(<HomeScreen />, { world });
    fireEvent.click(view.getByTestId('home-also-qibla'));
    expect(world.nav.last()).toEqual({ type: 'tab', route: { name: 'quran' } });
    fireEvent.click(view.getByTestId('home-also-updates'));
    expect(world.nav.last()).toEqual({ type: 'go', route: { name: 'updates' } });
  });
});

describe('Nearby (N2)', () => {
  it('has the search and the Map / List switch inside the green header', async () => {
    const view = await renderScreen(<NearbyScreen />, { cityId: CITY_RAWALPINDI.id });
    const header = await view.findByTestId('screen-header');
    expect(within(header).getByTestId('nearby-search')).toBeTruthy();
    expect(within(header).getByTestId('nearby-view')).toBeTruthy();
  });

  it('ends the list with "Ask for a circle near you", which says it is coming soon', async () => {
    const view = await renderScreen(<NearbyScreen />, { cityId: CITY_RAWALPINDI.id });
    const list = await view.findByTestId('nearby-list');
    const ask = within(list).getByTestId('nearby-ask');
    expect(within(ask).getByText(en['nearby.ask.title'])).toBeTruthy();
    expect(list.lastElementChild).toBe(ask);
    fireEvent.click(within(ask).getByTestId('nearby-ask-action'));
    expect(await view.findByText(en['nearby.request.soon'])).toBeTruthy();
  });

  it('shows small cards for the nearest places on the map and selects one when tapped', async () => {
    const view = await renderScreen(<NearbyScreen />, { cityId: CITY_RAWALPINDI.id });
    await view.findByTestId('nearby-list');
    fireEvent.click(within(view.getByTestId('nearby-view')).getByText(en['nearby.view.map']));
    const nearest = await view.findByTestId('map-nearest');
    const card = nearest.querySelector<HTMLElement>('[data-testid^="map-nearest-"]');
    expect(card).not.toBeNull();
    fireEvent.click(card!);
    expect(await view.findByTestId('map-selection')).toBeTruthy();
  });
});

describe('Session and venue (S1)', () => {
  it('has a photo area on top, tags for who it is for, and one Register bar', async () => {
    const view = await renderScreen(<SessionScreen sessionId={SESSIONS.taraweeh.id} />);
    const header = await view.findByTestId('screen-header');
    expect(within(header).getByTestId('session-photo')).toBeTruthy();
    expect(await view.findByTestId('register-button')).toBeTruthy();
    expect(view.getAllByTestId('register-button')).toHaveLength(1);
    expect(view.getAllByText(en['sections.family']).length).toBeGreaterThan(0);
  });

  it('has the photo area on the venue page too', async () => {
    const view = await renderScreen(<VenueScreen venueId={noor.id} />);
    const header = await view.findByTestId('screen-header');
    expect(within(header).getByTestId('venue-photo')).toBeTruthy();
  });
});

describe('Registration (R2)', () => {
  async function open(session = SESSIONS.taraweeh) {
    const world = await createWorld({ signedIn: true, cityId: CITY_RAWALPINDI.id });
    const view = await renderScreen(<RegistrationScreen sessionId={session.id} />, { world });
    await view.findByTestId('registration-form');
    return { world, view };
  }

  it('opens as a sheet with a close button and the session in the green top', async () => {
    const { world, view } = await open();
    const header = view.getByTestId('screen-header');
    expect(within(header).getByTestId('registration-summary')).toBeTruthy();
    fireEvent.click(view.getByTestId('sheet-close'));
    expect(world.nav.last()).toEqual({ type: 'back' });
  });

  it.each(['women', 'men', 'family'] as const)(
    'offers %s on a family session, and sends the choice',
    async (section) => {
      const { world, view } = await open();
      for (const s of ['women', 'men', 'family']) {
        expect(
          view.getByTestId(`registration-section-${s}`).getAttribute('aria-disabled'),
        ).not.toBe('true');
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

  it('fades the sections a women-only session does not offer', async () => {
    const { view } = await open(SESSIONS.womenFull);
    expect(view.getByTestId('registration-section-women').getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(view.getByTestId('registration-section-men').getAttribute('aria-disabled')).toBe('true');
    expect(view.getByTestId('registration-section-family').getAttribute('aria-disabled')).toBe(
      'true',
    );
    expect(view.getByTestId('registration-section-fixed')).toBeTruthy();
  });

  it('counts the people with the stepper and sends the number', async () => {
    const { world, view } = await open();
    fireEvent.click(view.getByTestId('registration-party-plus'));
    fireEvent.click(view.getByTestId('registration-party-plus'));
    expect(view.getByTestId('registration-party-value').textContent).toBe('3');
    fireEvent.click(view.getByTestId('registration-party-minus'));
    expect(view.getByTestId('registration-party-value').textContent).toBe('2');
    fireEvent.click(view.getByTestId('registration-area'));
    fireEvent.click(await view.findByTestId(`area-option-${AREA_SADDAR.id}`));
    fireEvent.click(view.getByTestId('registration-section-family'));
    fireEvent.click(view.getByTestId('registration-submit'));
    await waitFor(() => expect(world.http.callsTo('POST /v1/registrations')).toHaveLength(1));
    expect(world.http.callsTo('POST /v1/registrations')[0]!.body).toMatchObject({ partySize: 2 });
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
  it('opens with three numbers: upcoming, waiting and following', async () => {
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
    await waitFor(() =>
      expect(view.getByTestId('journey-stat-upcoming').textContent).toContain('1'),
    );
    expect(view.getByTestId('journey-stat-waiting').textContent).toContain('1');
    expect(view.getByTestId('journey-stat-following').textContent).toContain('1');
    expect(within(view.getByTestId('screen-header')).getByTestId('journey-summary')).toBeTruthy();
  });

  it('shows no numbers to a signed-out person', async () => {
    const view = await renderScreen(<JourneyScreen />);
    expect(view.queryByTestId('journey-summary')).toBeNull();
  });
});

describe('Profile, Updates and Sign-in (B)', () => {
  it('opens the profile with quick tiles in the green header', async () => {
    const world = await createWorld({ signedIn: true });
    const view = await renderScreen(<ProfileScreen />, { world });
    const header = view.getByTestId('screen-header');
    expect(within(header).getByTestId('profile-tiles')).toBeTruthy();
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

  it('takes the sign-in code in boxed cells and accepts digits only', async () => {
    const view = await renderScreen(<SignInScreen />);
    fireEvent.change(view.getByTestId('phone-input'), { target: { value: '03001234567' } });
    fireEvent.click(view.getByTestId('send-code'));
    const code = await view.findByTestId('code-input');
    fireEvent.change(code, { target: { value: '12a3b4' } });
    expect((code as HTMLInputElement).value).toBe('1234');
  });
});
