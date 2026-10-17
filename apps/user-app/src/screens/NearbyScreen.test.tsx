import { fireEvent, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { messages } from '@qc/i18n';
import { fixtures } from '@qc/contracts/fixtures';
import { CITY_RAWALPINDI, SESSIONS } from '../test/factories';
import {
  MATRIX,
  createWorld,
  directionOf,
  expectGreenHeader,
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
    expect(within(list).getByText(SESSIONS.taraweeh.title.en)).toBeTruthy();
    expect(within(list).getByText(SESSIONS.circle.title.en)).toBeTruthy();
    expect(within(list).getAllByText(SESSIONS.taraweeh.venue.name.en).length).toBeGreaterThan(0);
    expect(view.world.http.callsTo('GET /v1/sessions')[0]!.search).toContain('limit=20');
  });

  it('opens a session when its card is pressed', async () => {
    const view = await renderScreen(<NearbyScreen />);
    fireEvent.click(await view.findByTestId(`session-card-${SESSIONS.circle.id}`));
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
    expect(view.getByTestId('active-filters')).toBeTruthy();
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
    expect(within(selection).getByText(SESSIONS.taraweeh.title.en)).toBeTruthy();
    fireEvent.click(within(selection).getByText(en['nearby.map.viewVenue']));
    expect(view.world.nav.last()).toEqual({
      type: 'go',
      route: { name: 'venue', venueId: SESSIONS.taraweeh.venueId },
    });
  });

  it('says so when nothing matches, and clears the filters from there', async () => {
    const view = await renderScreen(<NearbyScreen />, {
      mock: { handlers: { 'sessions.list': () => ({ items: [], nextCursor: null }) } },
    });
    const empty = await view.findByTestId('nearby-empty');
    expect(within(empty).getByText(en['nearby.empty.title'])).toBeTruthy();
    expect(within(empty).getByText(en['nearby.empty.body'])).toBeTruthy();
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
    expect(within(list).getByText(SESSIONS.taraweeh.title.en)).toBeTruthy();
    expect(await second.findByTestId('saved-copy-note')).toBeTruthy();
    expect(await second.findByTestId('offline-banner')).toBeTruthy();
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

  describe('one chip row under the search (N2)', () => {
    it('holds the city, area, day, the three sections and the filters', async () => {
      const view = await renderScreen(<NearbyScreen />);
      await view.findByTestId('nearby-list');
      const header = view.getByTestId('screen-header');
      const chips = within(header).getByTestId('nearby-chips');
      for (const id of [
        'nearby-city',
        'nearby-area-button',
        'nearby-day',
        'nearby-section-women',
        'nearby-section-men',
        'nearby-section-family',
        'nearby-filters-button',
      ]) {
        expect(within(chips).getByTestId(id)).toBeTruthy();
      }
    });

    it('turns a section on and off from its chip, and asks the server for it', async () => {
      const view = await renderScreen(<NearbyScreen />);
      await view.findByTestId('nearby-list');
      const women = view.getByTestId('nearby-section-women');
      fireEvent.click(women);
      await waitFor(() => {
        const last = view.world.http.callsTo('GET /v1/sessions').at(-1)!;
        expect(new URLSearchParams(last.search).get('section')).toBe('women');
      });
      expect(view.getByTestId('nearby-section-women').getAttribute('aria-checked')).toBe('true');
      fireEvent.click(view.getByTestId('nearby-section-women'));
      // Off again: the list without a section comes back (from the saved answer).
      await waitFor(() =>
        expect(view.getByTestId('nearby-section-women').getAttribute('aria-checked')).toBe('false'),
      );
      expect(await view.findByTestId('nearby-list')).toBeTruthy();
    });

    it('chooses the city from a sheet, and keeps it for next time', async () => {
      const view = await renderScreen(<NearbyScreen />);
      await view.findByTestId('nearby-list');
      fireEvent.click(view.getByTestId('nearby-city'));
      fireEvent.click(await view.findByTestId(`city-option-${CITY_RAWALPINDI.id}`));
      await waitFor(() => {
        const last = view.world.http.callsTo('GET /v1/sessions').at(-1)!;
        expect(new URLSearchParams(last.search).get('cityId')).toBe(CITY_RAWALPINDI.id);
      });
      expect(view.world.services.preferences.get().cityId).toBe(CITY_RAWALPINDI.id);
      expect(view.getByTestId('nearby-city').textContent).toContain(CITY_RAWALPINDI.name.en);
    });

    it('opens the day choice from the Day chip and names the days picked', async () => {
      const view = await renderScreen(<NearbyScreen />);
      await view.findByTestId('nearby-list');
      fireEvent.click(view.getByTestId('nearby-day'));
      fireEvent.click(await view.findByTestId('filter-day-2'));
      fireEvent.click(view.getByTestId('filters-apply'));
      await waitFor(() =>
        expect(view.getByTestId('nearby-day').textContent).toContain(en['days.tue']),
      );
    });
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
      expectGreenHeader(view.container, color);
      expect(view.getByText((locale === 'ur' ? ur : en)['tabs.nearby'])).toBeTruthy();
      const first =
        locale === 'ur'
          ? (SESSIONS.taraweeh.title.ur ?? SESSIONS.taraweeh.title.en)
          : SESSIONS.taraweeh.title.en;
      expect(within(view.getByTestId('nearby-list')).getByText(first)).toBeTruthy();
    });
  });
});
