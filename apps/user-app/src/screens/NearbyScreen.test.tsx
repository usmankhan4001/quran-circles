import { act, fireEvent, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { messages } from '@qc/i18n';
import { fixtures } from '@qc/contracts/fixtures';
import { CITY_RAWALPINDI, SESSIONS, registrationFor } from '../test/factories';
import {
  FakeNetwork,
  MATRIX,
  createWorld,
  directionOf,
  renderScreen,
  waitFor,
} from '../test/harness';
import { NearbyScreen } from './NearbyScreen';

const en = messages.en;

/** How many of the listed sessions are at one venue, as the pins count them. */
function SESSIONS_AT(venueId: string): number {
  return fixtures.sessions.filter((x) => x.venueId === venueId).length;
}
const ur = messages.ur;

describe('NearbyScreen', () => {
  it('lists the sessions the server returns, with where and when', async () => {
    const view = await renderScreen(<NearbyScreen />);
    const list = await view.findByTestId('nearby-list');
    expect(within(list).getAllByText(SESSIONS.taraweeh.venue.name.en).length).toBeGreaterThan(0);
    expect(within(list).getAllByText(SESSIONS.circle.venue.name.en).length).toBeGreaterThan(0);
    // Each row carries the start time as its biggest figure.
    expect(within(list).getAllByRole('button').length).toBeGreaterThan(1);
    expect(view.world.http.callsTo('GET /v1/sessions')[0]!.search).toContain('limit=20');
  });

  it('opens a session when its card is pressed', async () => {
    const view = await renderScreen(<NearbyScreen />);
    fireEvent.click(await view.findByTestId(`nearby-row-${SESSIONS.circle.id}`));
    expect(view.world.nav.last()).toEqual({
      type: 'go',
      route: { name: 'session', sessionId: SESSIONS.circle.id },
    });
  });

  it('asks the server for the day, time and section picked in the filters', async () => {
    const view = await renderScreen(<NearbyScreen />);
    await view.findByTestId('nearby-list');
    fireEvent.click(view.getByTestId('nearby-filters-button'));
    fireEvent.click(await view.findByTestId('filter-day-2'));
    fireEvent.click(view.getByTestId('filter-time-evening'));
    fireEvent.click(view.getByTestId('filter-section-family'));
    fireEvent.click(view.getByTestId('filter-language-ur'));
    fireEvent.click(view.getByTestId('filters-apply'));
    await waitFor(() => {
      const last = view.world.http.callsTo('GET /v1/sessions').at(-1)!;
      const params = new URLSearchParams(last.search);
      expect(params.getAll('dayOfWeek')).toEqual(['2']);
      expect(params.get('timeFrom')).toBe('17:00');
      expect(params.get('timeTo')).toBe('20:29');
      expect(params.get('section')).toBe('family');
      expect(params.get('language')).toBe('ur');
    });
    expect(view.getByTestId('nearby-filters-button').textContent).toContain('(4)');
  });

  it('filters by the city chosen', async () => {
    const view = await renderScreen(<NearbyScreen />, { cityId: CITY_RAWALPINDI.id });
    await view.findByTestId('nearby-list');
    const last = view.world.http.callsTo('GET /v1/sessions').at(-1)!;
    expect(new URLSearchParams(last.search).get('cityId')).toBe(CITY_RAWALPINDI.id);
  });

  it('sorts by distance from the area the person picked, without asking for their location', async () => {
    const area = (await import('@qc/contracts/fixtures')).fixtures.areas[0]!;
    const view = await renderScreen(<NearbyScreen />, {
      cityId: CITY_RAWALPINDI.id,
      areaId: area.id,
    });
    await view.findByTestId('nearby-list');
    await waitFor(() => {
      const last = view.world.http.callsTo('GET /v1/sessions').at(-1)!;
      const params = new URLSearchParams(last.search);
      expect(params.get('lat')).toBe(String(area.lat));
      expect(params.get('lng')).toBe(String(area.lng));
    });
  });

  it('shows a map of the venues through the swappable map view, with the list as fallback', async () => {
    const view = await renderScreen(<NearbyScreen />);
    await view.findByTestId('nearby-list');
    fireEvent.click(within(view.getByTestId('nearby-view')).getByText(en['nearby.view.map']));
    const map = await view.findByTestId('map-list-only');
    expect(within(map).getAllByText(SESSIONS.taraweeh.venue.name.en).length).toBeGreaterThan(0);
    fireEvent.click(view.getByTestId(`map-marker-${SESSIONS.taraweeh.venueId}`));
    const selection = await view.findByTestId('map-selection');
    expect(within(selection).getAllByText(SESSIONS.taraweeh.venue.name.en).length).toBeGreaterThan(
      0,
    );
    fireEvent.click(within(selection).getByText(en['nearby.map.viewVenue']));
    expect(view.world.nav.last()).toEqual({
      type: 'go',
      route: { name: 'venue', venueId: SESSIONS.taraweeh.venueId },
    });
  });

  describe('joining from a place on the map', () => {
    async function openCard(options: { signedIn?: boolean; locale?: 'en' | 'ur' } = {}) {
      const view = await renderScreen(<NearbyScreen />, options);
      await view.findByTestId('nearby-list');
      const words = messages[options.locale ?? 'en'];
      fireEvent.click(within(view.getByTestId('nearby-view')).getByText(words['nearby.view.map']));
      fireEvent.click(await view.findByTestId(`map-marker-${SESSIONS.taraweeh.venueId}`));
      return { view, words, selection: await view.findByTestId('map-selection') };
    }

    it('offers a Join action on the session card, which opens the join flow when signed in', async () => {
      const { view, words } = await openCard({ signedIn: true });
      fireEvent.click(view.getByTestId(`map-join-${SESSIONS.taraweeh.id}`));
      expect(words['session.join']).toBeTruthy();
      expect(view.world.nav.last()).toEqual({
        type: 'go',
        route: { name: 'register', sessionId: SESSIONS.taraweeh.id },
      });
    });

    it('takes a signed-out person straight to the pledge sheet, which signs them in itself', async () => {
      const { view } = await openCard();
      fireEvent.click(view.getByTestId(`map-join-${SESSIONS.taraweeh.id}`));
      expect(view.world.nav.last()).toEqual({
        type: 'go',
        route: { name: 'register', sessionId: SESSIONS.taraweeh.id },
      });
    });

    it('shows Joined for a session already joined, which opens the journey', async () => {
      const view = await renderScreen(<NearbyScreen />, {
        signedIn: true,
        mock: {
          handlers: {
            'registrations.listMine': () => ({
              items: [registrationFor(SESSIONS.taraweeh)],
              nextCursor: null,
            }),
          },
        },
      });
      await view.findByTestId('nearby-list');
      fireEvent.click(within(view.getByTestId('nearby-view')).getByText(en['nearby.view.map']));
      fireEvent.click(await view.findByTestId(`map-marker-${SESSIONS.taraweeh.venueId}`));
      const join = await view.findByTestId(`map-join-${SESSIONS.taraweeh.id}`);
      await waitFor(() => expect(join.textContent).toBe(en['session.joined']));
      fireEvent.click(join);
      expect(view.world.nav.last()).toEqual({ type: 'tab', route: { name: 'journey' } });
    });

    it('reads in Urdu, right to left', async () => {
      const { view, words, selection } = await openCard({ locale: 'ur' });
      expect(within(selection).getAllByText(words['session.join']).length).toBeGreaterThan(0);
      expect(directionOf(view.container)).toBe('rtl');
    });
  });

  describe('the map list shown without a map provider', () => {
    const venue = SESSIONS.taraweeh.venue;
    const area = fixtures.areas.find((a) => a.id === venue.areaId)!;
    const city = fixtures.cities.find((c) => c.id === venue.cityId)!;
    /** "31.5204, 74.3587": what the list used to print under each place. */
    const COORDINATES = /-?\d{1,3}\.\d{3,}\s*,\s*-?\d{1,3}\.\d{3,}/;

    async function openMap(options: Parameters<typeof renderScreen>[1] = {}) {
      const view = await renderScreen(<NearbyScreen />, { cityId: venue.cityId, ...options });
      await view.findByTestId('nearby-list');
      const words = options.locale === 'ur' ? ur : en;
      fireEvent.click(within(view.getByTestId('nearby-view')).getByText(words['nearby.view.map']));
      return { view, map: await view.findByTestId('map-list-only') };
    }

    it('says where each place is in words, never as coordinates', async () => {
      const { view, map } = await openMap();
      expect(map.textContent).not.toMatch(COORDINATES);
      await waitFor(() =>
        expect(view.getByTestId(`map-marker-location-${venue.id}`).textContent).toBe(
          `${area.name.en}${en['schedule.separator']}${city.name.en}`,
        ),
      );
    });

    it('adds how far the place is from the area the person picked', async () => {
      const { view, map } = await openMap({ areaId: area.id });
      await waitFor(() =>
        expect(view.getByTestId(`map-marker-location-${venue.id}`).textContent).toMatch(
          / · \d+(\.\d)? (km|m)$/,
        ),
      );
      expect(map.textContent).not.toMatch(COORDINATES);
    });

    it('writes the area and city in Urdu on an Urdu screen', async () => {
      const { view } = await openMap({ locale: 'ur' });
      await waitFor(() =>
        expect(view.getByTestId(`map-marker-location-${venue.id}`).textContent).toBe(
          `${area.name.ur ?? area.name.en}${ur['schedule.separator']}${city.name.ur ?? city.name.en}`,
        ),
      );
    });

    it('keeps a plain note that the map is not available', async () => {
      const { map } = await openMap();
      expect(within(map).getByTestId('map-unavailable').textContent).toBe(
        en['nearby.map.unavailable'],
      );
    });

    it('leaves the location line out when the places cannot be read', async () => {
      const { view } = await openMap({
        mock: {
          handlers: {
            'places.areas': () => new Response('{}', { status: 503 }),
            'places.cities': () => new Response('{}', { status: 503 }),
          },
        },
      });
      expect(view.getByTestId(`map-marker-${venue.id}`)).toBeTruthy();
      expect(view.queryByTestId(`map-marker-location-${venue.id}`)).toBeNull();
    });
  });

  it('says so when nothing matches, and clears the filters from there', async () => {
    const view = await renderScreen(<NearbyScreen />, {
      mock: { handlers: { 'sessions.list': () => ({ items: [], nextCursor: null }) } },
    });
    const empty = await view.findByTestId('nearby-empty');
    expect(within(empty).getByText(en['states.noCircles.title'])).toBeTruthy();
    expect(within(empty).getByText(en['states.noCircles.body'])).toBeTruthy();
  });

  it('offers to try again after a failure', async () => {
    const world = await createWorld();
    world.http.failNext('GET /v1/sessions', 'internal_error');
    const view = await renderScreen(<NearbyScreen />, { world });
    const error = await view.findByTestId('nearby-error');
    expect(within(error).getByText(en['errors.internal_error'])).toBeTruthy();
    fireEvent.click(within(error).getByText(en['ui.retry']));
    expect(await view.findByTestId('nearby-list')).toBeTruthy();
  });

  it('shows the saved list, and says so, when the app opens with no connection', async () => {
    const first = await renderScreen(<NearbyScreen />);
    await first.findByTestId('nearby-list');
    await first.world.services.cache.flush();
    first.unmount();

    // The same phone opens the app again later with no signal: new services, the same storage.
    const world = await createWorld({ deviceStore: first.world.deviceStore });
    world.services.cache.invalidate('sessions');
    world.http.setOffline(true);
    const second = await renderScreen(<NearbyScreen />, { world });
    const list = await second.findByTestId('nearby-list');
    expect(within(list).getAllByText(SESSIONS.taraweeh.venue.name.en).length).toBeGreaterThan(0);
    expect(await second.findByTestId('saved-copy-note')).toBeTruthy();
    expect(await second.findByTestId('offline-banner')).toBeTruthy();
  });

  it('shows the offline banner over the saved list as soon as the device loses its connection', async () => {
    const network = new FakeNetwork(true);
    const world = await createWorld({ network });
    const view = await renderScreen(<NearbyScreen />, { world });
    await view.findByTestId('nearby-list');
    expect(view.queryByTestId('offline-banner')).toBeNull();
    const callsBefore = world.http.calls.length;

    act(() => network.set(false));
    expect(await view.findByTestId('offline-banner')).toBeTruthy();
    expect(view.getByTestId('nearby-list')).toBeTruthy();
    expect(world.http.calls.length).toBe(callsBefore);

    act(() => network.set(true));
    await waitFor(() => expect(view.queryByTestId('offline-banner')).toBeNull());
  });

  it('shows the offline banner on a start with no connection, from the device state alone', async () => {
    const world = await createWorld({ network: new FakeNetwork(false) });
    const view = await renderScreen(<NearbyScreen />, { world });
    expect(await view.findByTestId('offline-banner')).toBeTruthy();
  });

  it('searches by name', async () => {
    const view = await renderScreen(<NearbyScreen />);
    await view.findByTestId('nearby-list');
    fireEvent.change(view.getByTestId('nearby-search'), { target: { value: 'Noor' } });
    await waitFor(() => {
      const last = view.world.http.callsTo('GET /v1/sessions').at(-1)!;
      expect(new URLSearchParams(last.search).get('q')).toBe('Noor');
    });
  });

  describe('the chips under the view switch', () => {
    it('offers Women, Men, Family, Tonight and the filters', async () => {
      const view = await renderScreen(<NearbyScreen />);
      await view.findByTestId('nearby-list');
      for (const id of [
        'nearby-section-women',
        'nearby-section-men',
        'nearby-section-family',
        'nearby-tonight',
        'nearby-filters-button',
      ]) {
        expect(view.getByTestId(id)).toBeTruthy();
      }
    });

    it('picks a section chip, asks the server for it, and takes it off again', async () => {
      const view = await renderScreen(<NearbyScreen />);
      await view.findByTestId('nearby-list');
      fireEvent.click(view.getByTestId('nearby-section-women'));
      await waitFor(() => {
        const last = view.world.http.callsTo('GET /v1/sessions').at(-1)!;
        expect(new URLSearchParams(last.search).get('section')).toBe('women');
      });
      expect(view.getByTestId('nearby-section-women').getAttribute('aria-checked')).toBe('true');
      fireEvent.click(view.getByTestId('nearby-section-women'));
      await waitFor(() =>
        expect(view.getByTestId('nearby-section-women').getAttribute('aria-checked')).toBe('false'),
      );
    });

    it('asks for tonight (after Isha) with the Tonight chip', async () => {
      const view = await renderScreen(<NearbyScreen />);
      await view.findByTestId('nearby-list');
      fireEvent.click(view.getByTestId('nearby-tonight'));
      await waitFor(() => {
        const last = view.world.http.callsTo('GET /v1/sessions').at(-1)!;
        expect(new URLSearchParams(last.search).get('timeFrom')).toBe('20:30');
      });
    });

    it('changes the city and area from the line above the title, and keeps them', async () => {
      const view = await renderScreen(<NearbyScreen />);
      await view.findByTestId('nearby-list');
      fireEvent.click(view.getByTestId('nearby-area-button'));
      fireEvent.click(await view.findByTestId(`area-city-${CITY_RAWALPINDI.id}`));
      await waitFor(() => {
        const last = view.world.http.callsTo('GET /v1/sessions').at(-1)!;
        expect(new URLSearchParams(last.search).get('cityId')).toBe(CITY_RAWALPINDI.id);
      });
      expect(view.world.services.preferences.get().cityId).toBe(CITY_RAWALPINDI.id);
    });
  });

  it('asks a person on the map with no area to choose one, and says why', async () => {
    const view = await renderScreen(<NearbyScreen />);
    await view.findByTestId('nearby-list');
    fireEvent.click(within(view.getByTestId('nearby-view')).getByText(en['nearby.view.map']));
    expect(await view.findByTestId('nearby-location-off')).toBeTruthy();
    expect(view.getByText(en['nearby.location.offTitle'])).toBeTruthy();
    fireEvent.click(view.getByTestId('nearby-choose-area'));
    expect(await view.findByTestId(`area-city-${CITY_RAWALPINDI.id}`)).toBeTruthy();
  });

  it('draws green pins on the map with the number of circles at each place', async () => {
    const view = await renderScreen(<NearbyScreen />);
    await view.findByTestId('nearby-list');
    fireEvent.click(within(view.getByTestId('nearby-view')).getByText(en['nearby.view.map']));
    await view.findByTestId('map-list-only');
    const pin = view.getByTestId(`map-pin-${SESSIONS.taraweeh.venueId}`);
    expect(pin.getAttribute('aria-hidden')).toBe('true');
    const here = SESSIONS_AT(SESSIONS.taraweeh.venueId);
    expect(pin.textContent).toBe(here > 1 ? String(here) : '');
  });

  describe.each(MATRIX)('in $name', ({ locale, color, textSize }) => {
    it('draws the list in the right direction with its own words', async () => {
      const view = await renderScreen(<NearbyScreen />, { locale, color, textSize });
      await view.findByTestId('nearby-list');
      expect(directionOf(view.container)).toBe(locale === 'ur' ? 'rtl' : 'ltr');
      // A white header with the big title and no coloured band.
      const heading = within(view.getByTestId('screen-header')).getByRole('heading', {
        name: (locale === 'ur' ? ur : en)['nearby.title'],
      });
      expect(heading).toBeTruthy();
      void color;
      const venue =
        locale === 'ur'
          ? (SESSIONS.taraweeh.venue.name.ur ?? SESSIONS.taraweeh.venue.name.en)
          : SESSIONS.taraweeh.venue.name.en;
      expect(within(view.getByTestId('nearby-list')).getAllByText(venue).length).toBeGreaterThan(0);
    });
  });

  it('falls back to the list with a plain note when the map needs internet', async () => {
    const network = new FakeNetwork(true);
    const world = await createWorld({ cityId: CITY_RAWALPINDI.id, network });
    const view = await renderScreen(<NearbyScreen />, { world });
    await view.findByTestId('nearby-list');
    await act(async () => network.set(false));
    fireEvent.click(within(view.getByTestId('nearby-view')).getByText(en['nearby.view.map']));
    expect(await view.findByTestId('map-offline')).toBeTruthy();
    expect(view.getByTestId('nearby-list')).toBeTruthy();
  });

  it('opens the full-screen map from the map view', async () => {
    const view = await renderScreen(<NearbyScreen />, { cityId: CITY_RAWALPINDI.id });
    await view.findByTestId('nearby-list');
    fireEvent.click(within(view.getByTestId('nearby-view')).getByText(en['nearby.view.map']));
    fireEvent.click(await view.findByTestId('nearby-open-full-map'));
    expect(view.world.nav.last()).toEqual({ type: 'go', route: { name: 'map' } });
  });
});
