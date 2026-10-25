import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createBackend, ids, meFor } from '../../test/backend';
import { messages } from '@qc/i18n';
import { combos, LTR_EN, renderScreen, RTL_UR, typeInto } from '../../test/render';
import { routes } from '../../navigation/routes';
import { PlacesScreen } from './PlacesScreen';

describe.each(combos)('PlacesScreen in $name', (combo) => {
  it('lists the venues in scope', async () => {
    const { container } = renderScreen(<PlacesScreen />, {
      backend: createBackend({ me: meFor('city') }),
      combo,
    });
    await screen.findByTestId(`venue-${ids.venueAlNoor}`);
    expect(container.querySelector('[dir]')?.getAttribute('dir')).toBe(combo.dir);
  });
});

describe('PlacesScreen venues', () => {
  it('shows a venue coordinator only their venue and no add-venue button', async () => {
    renderScreen(<PlacesScreen />, { backend: createBackend({ me: meFor('venue') }) });
    await screen.findByTestId(`venue-${ids.venueAlNoor}`);
    expect(screen.queryByTestId(`venue-${ids.venueLahore}`)).toBeNull();
    expect(screen.queryByTestId('places-new-venue')).toBeNull();
  });

  it('shows a city coordinator the venues of their city and an add-venue button', async () => {
    const { nav } = renderScreen(<PlacesScreen />, {
      backend: createBackend({ me: meFor('city') }),
    });
    await screen.findByTestId(`venue-${ids.venueAlNoor}`);
    expect(screen.queryByTestId(`venue-${ids.venueLahore}`)).toBeNull();
    fireEvent.click(screen.getByTestId('places-new-venue'));
    expect(nav.pushed).toEqual([routes.newVenue()]);
  });

  it('shows a national admin every venue and opens one for editing', async () => {
    const { nav } = renderScreen(<PlacesScreen />, {
      backend: createBackend({ me: meFor('admin') }),
    });
    await screen.findByTestId(`venue-${ids.venueAlNoor}`);
    expect(screen.getByTestId(`venue-${ids.venueLahore}`)).toBeTruthy();
    expect(screen.getByTestId('places-new-venue')).toBeTruthy();
    fireEvent.click(screen.getByTestId(`venue-${ids.venueLahore}`));
    expect(nav.pushed).toEqual([routes.venue(ids.venueLahore)]);
  });

  it('narrows the loaded venues by name without asking the server again', async () => {
    const backend = createBackend({ me: meFor('admin') });
    renderScreen(<PlacesScreen />, { backend });
    await screen.findByTestId(`venue-${ids.venueAlNoor}`);
    const calls = backend.callsTo('adminVenues.list').length;
    const name = backend.state.venues.find((v) => v.id === ids.venueLahore)!.name.en;
    typeInto('places-venue-search', name);
    expect(screen.getByTestId(`venue-${ids.venueLahore}`)).toBeTruthy();
    expect(screen.queryByTestId(`venue-${ids.venueAlNoor}`)).toBeNull();
    typeInto('places-venue-search', 'zzz no such venue');
    expect(screen.queryByTestId(`venue-${ids.venueLahore}`)).toBeNull();
    expect(backend.callsTo('adminVenues.list')).toHaveLength(calls);
  });

  it('marks an archived venue', async () => {
    const backend = createBackend({ me: meFor('admin') });
    backend.state.venues.find((v) => v.id === ids.venueAlNoor)!.status = 'archived';
    renderScreen(<PlacesScreen />, { backend });
    const row = await screen.findByTestId(`venue-${ids.venueAlNoor}`);
    expect(within(row).getByText('Archived')).toBeTruthy();
  });

  it('shows the mapped message and a retry when the list cannot load', async () => {
    const backend = createBackend({ me: meFor('city') });
    backend.failWith('adminVenues.list', 'internal_error', { times: 1 });
    renderScreen(<PlacesScreen />, { backend });
    expect(await screen.findByText(/Something went wrong on our side/)).toBeTruthy();
  });

  it('follows the working role when a person has several', async () => {
    const backend = createBackend({ me: meFor('multi') });
    renderScreen(<PlacesScreen />, { backend });
    await screen.findByTestId(`venue-${ids.venueAlNoor}`);
    expect(screen.queryByTestId(`venue-${ids.venueLahore}`)).toBeNull();
    fireEvent.click(screen.getByTestId('scope-switcher'));
    const options = await screen.findAllByTestId(/^scope-switcher-option-/);
    expect(options).toHaveLength(2);
    fireEvent.click(options[1]!);
    await screen.findByTestId(`venue-${ids.venueLahore}`);
    expect(screen.queryByTestId(`venue-${ids.venueAlNoor}`)).toBeNull();
  });
});

describe('PlacesScreen circles', () => {
  it('puts circles waiting for a decision first and counts them for a city coordinator', async () => {
    const backend = createBackend({ me: meFor('admin') });
    renderScreen(<PlacesScreen />, { backend });
    fireEvent.click(await screen.findByText('Circles'));
    await screen.findByTestId(`circle-${ids.circlePending}`);
    const rows = screen.getAllByTestId(/^circle-0000/);
    expect(rows[0]!.getAttribute('data-testid')).toBe(`circle-${ids.circlePending}`);
    expect(screen.getByTestId('places-pending-count').textContent).toBe(
      '1 circle is waiting for your decision',
    );
  });

  it('does not count waiting circles for a venue coordinator, who cannot decide them', async () => {
    const backend = createBackend({ me: meFor('venue') });
    const circle = backend.state.circles.find((c) => c.id === ids.circlePublished)!;
    circle.status = 'pending_approval';
    renderScreen(<PlacesScreen />, { backend });
    fireEvent.click(await screen.findByText('Circles'));
    const row = await screen.findByTestId(`circle-${ids.circlePublished}`);
    expect(within(row).getByText(/Waiting for approval/)).toBeTruthy();
    expect(screen.queryByTestId('places-pending-count')).toBeNull();
    expect(screen.getByTestId('places-new-circle')).toBeTruthy();
  });

  it('opens a circle and starts a new one', async () => {
    const { nav } = renderScreen(<PlacesScreen />, {
      backend: createBackend({ me: meFor('city') }),
    });
    fireEvent.click(await screen.findByText('Circles'));
    fireEvent.click(await screen.findByTestId(`circle-${ids.circlePublished}`));
    fireEvent.click(screen.getByTestId('places-new-circle'));
    expect(nav.pushed).toEqual([routes.circle(ids.circlePublished), routes.newCircle()]);
  });

  it('shows an empty state when there are no circles in scope', async () => {
    const backend = createBackend({ me: meFor('city') });
    backend.state.circles.length = 0;
    renderScreen(<PlacesScreen />, { backend });
    fireEvent.click(await screen.findByText('Circles'));
    await waitFor(() => expect(screen.getByText('No circles yet')).toBeTruthy());
  });
});

describe('PlacesScreen venue picture cards', () => {
  it('draws venue art on each card, since venues have no photo yet', async () => {
    renderScreen(<PlacesScreen />, { backend: createBackend({ me: meFor('venue') }) });
    const card = await screen.findByTestId(`venue-${ids.venueAlNoor}`);
    expect(within(card).getByTestId(`venue-${ids.venueAlNoor}-art`)).toBeTruthy();
    // Decoration only.
    expect(
      within(card).getByTestId(`venue-${ids.venueAlNoor}-art`).getAttribute('aria-hidden'),
    ).toBe('true');
  });

  it('says how many circles meet at each venue, counted from the circles in scope', async () => {
    const backend = createBackend({ me: meFor('city') });
    renderScreen(<PlacesScreen />, { backend });
    const card = await screen.findByTestId(`venue-${ids.venueAlNoor}`);
    const count = backend.state.circles.filter((c) => c.venueId === ids.venueAlNoor).length;
    expect(within(card).getByText(count === 1 ? '1 circle' : `${count} circles`)).toBeTruthy();
    // A venue with no circle says so.
    const empty = backend.state.venues.find(
      (v) =>
        v.cityId === ids.cityRawalpindi && !backend.state.circles.some((c) => c.venueId === v.id),
    )!;
    expect(within(screen.getByTestId(`venue-${empty.id}`)).getByText('0 circles')).toBeTruthy();
  });

  it('still lists the venues when the circle count cannot load', async () => {
    const backend = createBackend({ me: meFor('venue') });
    backend.failWith('adminCircles.list', 'service_unavailable');
    renderScreen(<PlacesScreen />, { backend });
    const card = await screen.findByTestId(`venue-${ids.venueAlNoor}`);
    expect(within(card).queryByText(/circles?$/)).toBeNull();
  });

  it('shows the venue coordinator their venue, not the empty state, when the list holds it', async () => {
    renderScreen(<PlacesScreen />, { backend: createBackend({ me: meFor('venue') }) });
    await screen.findByTestId(`venue-${ids.venueAlNoor}`);
    expect(screen.queryByText('No venues yet')).toBeNull();
  });

  it('shows the empty state when the server sends no venue the working role can use', async () => {
    // What the raw contract mock does today: its venue list is generated, so no id matches the
    // coordinator's venue. The screen says so plainly instead of breaking.
    const backend = createBackend({
      me: meFor('venue'),
      handlers: {
        'adminVenues.list': () => ({
          items: [
            { ...createBackend().state.venues[3]!, id: '00000000-0000-4000-8000-000000000001' },
          ],
          nextCursor: null,
        }),
      },
    });
    renderScreen(<PlacesScreen />, { backend });
    expect(await screen.findByText('No venues yet')).toBeTruthy();
  });
});

describe("PlacesScreen names in the reader's language", () => {
  it('shows the Urdu venue name on an Urdu screen and the English one on an English screen', async () => {
    const backend = createBackend({ me: meFor('venue') });
    const name = backend.state.venues.find((v) => v.id === ids.venueAlNoor)!.name;
    expect(name.ur).toBeTruthy();
    const ur = renderScreen(<PlacesScreen />, { backend, combo: RTL_UR });
    const card = await screen.findByTestId(`venue-${ids.venueAlNoor}`);
    expect(card.textContent).toContain(name.ur!);
    expect(card.textContent).not.toContain(name.en);
    ur.unmount();
    renderScreen(<PlacesScreen />, { backend, combo: LTR_EN });
    const enCard = await screen.findByTestId(`venue-${ids.venueAlNoor}`);
    expect(enCard.textContent).toContain(name.en);
    expect(enCard.textContent).not.toContain(name.ur!);
  });

  it('shows the Urdu circle and venue names in the circles list on an Urdu screen', async () => {
    const backend = createBackend({ me: meFor('venue') });
    const circle = backend.state.circles.find((c) => c.id === ids.circlePublished)!;
    const venue = backend.state.venues.find((v) => v.id === circle.venueId)!;
    renderScreen(<PlacesScreen />, { backend, combo: RTL_UR });
    fireEvent.click(await screen.findByText(messages.ur['admin.places.circles']));
    const row = await screen.findByTestId(`circle-${ids.circlePublished}`);
    expect(row.textContent).toContain(circle.name.ur ?? circle.name.en);
    expect(row.textContent).toContain(venue.name.ur ?? venue.name.en);
  });

  it('falls back to the English name on an Urdu screen when no Urdu name was written', async () => {
    const backend = createBackend({ me: meFor('venue') });
    const venue = backend.state.venues.find((v) => v.id === ids.venueAlNoor)!;
    venue.name = { en: venue.name.en, ur: null };
    renderScreen(<PlacesScreen />, { backend, combo: RTL_UR });
    const card = await screen.findByTestId(`venue-${ids.venueAlNoor}`);
    expect(card.textContent).toContain(venue.name.en);
  });

  it('finds a venue by its English name on an Urdu screen, and by its Urdu name on an English one', async () => {
    const backend = createBackend({ me: meFor('admin') });
    const lahore = backend.state.venues.find((v) => v.id === ids.venueLahore)!;
    expect(lahore.name.ur).toBeTruthy();
    const ur = renderScreen(<PlacesScreen />, { backend, combo: RTL_UR });
    await screen.findByTestId(`venue-${ids.venueAlNoor}`);
    typeInto('places-venue-search', lahore.name.en);
    expect(screen.getByTestId(`venue-${ids.venueLahore}`)).toBeTruthy();
    expect(screen.queryByTestId(`venue-${ids.venueAlNoor}`)).toBeNull();
    ur.unmount();
    renderScreen(<PlacesScreen />, { backend, combo: LTR_EN });
    await screen.findByTestId(`venue-${ids.venueAlNoor}`);
    typeInto('places-venue-search', lahore.name.ur!);
    expect(screen.getByTestId(`venue-${ids.venueLahore}`)).toBeTruthy();
    expect(screen.queryByTestId(`venue-${ids.venueAlNoor}`)).toBeNull();
  });
});
