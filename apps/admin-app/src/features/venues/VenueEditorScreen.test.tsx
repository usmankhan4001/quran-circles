import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import * as fx from '@qc/contracts/fixtures';
import { createBackend, ids, meFor, type RoleKind } from '../../test/backend';
import { routes } from '../../navigation/routes';
import { combos, LTR_EN, renderScreen, RTL_UR, typeInto } from '../../test/render';
import { VenueEditorScreen } from './VenueEditorScreen';

const rawalpindiArea = fx.areas.find((a) => a.cityId === ids.cityRawalpindi)!;

async function fillNewVenue() {
  await screen.findByTestId('venue-editor-form');
  await waitFor(() => {
    const trigger = screen.getByTestId('venue-area');
    expect(trigger.getAttribute('aria-disabled')).not.toBe('true');
    fireEvent.click(trigger);
    expect(screen.getByTestId(`venue-area-option-${rawalpindiArea.id}`)).toBeTruthy();
  });
  fireEvent.click(screen.getByTestId(`venue-area-option-${rawalpindiArea.id}`));
  typeInto('venue-name-en', 'Sample Masjid Noor');
  typeInto('venue-address-en', 'Street 9, Saddar');
  typeInto('venue-lat', '33.6');
  typeInto('venue-lng', '73.05');
}

describe.each(combos)('VenueEditorScreen in $name', (combo) => {
  it('shows the facilities checklist', async () => {
    const { container } = renderScreen(<VenueEditorScreen />, {
      backend: createBackend({ me: meFor('city') }),
      combo,
    });
    await screen.findByTestId('venue-editor-form');
    for (const key of [
      'womenSection',
      'parking',
      'wuduArea',
      'elderWheelchairAccess',
      'childFriendly',
    ]) {
      expect(screen.getByTestId(`venue-facility-${key}`).getAttribute('role')).toBe('checkbox');
    }
    expect(container.querySelector('[dir]')?.getAttribute('dir')).toBe(combo.dir);
  });
});

describe('VenueEditorScreen create', () => {
  it('lets a city coordinator add a venue with the facilities ticked', async () => {
    const backend = createBackend({ me: meFor('city') });
    const { nav } = renderScreen(<VenueEditorScreen />, { backend });
    await fillNewVenue();
    fireEvent.click(screen.getByTestId('venue-facility-womenSection'));
    fireEvent.click(screen.getByTestId('venue-facility-wuduArea'));
    expect(screen.getByTestId('venue-facility-womenSection').getAttribute('aria-checked')).toBe(
      'true',
    );
    fireEvent.click(screen.getByTestId('venue-save'));
    await waitFor(() => expect(nav.backs).toBe(1));
    expect(backend.callsTo('adminVenues.create')[0]!.body).toMatchObject({
      cityId: ids.cityRawalpindi,
      areaId: rawalpindiArea.id,
      name: { en: 'Sample Masjid Noor' },
      lat: 33.6,
      lng: 73.05,
      facilities: { womenSection: true, wuduArea: true, parking: false },
    });
    expect(backend.state.venues.some((v) => v.name.en === 'Sample Masjid Noor')).toBe(true);
  });

  it('shows what is missing and sends nothing', async () => {
    const backend = createBackend({ me: meFor('city') });
    renderScreen(<VenueEditorScreen />, { backend });
    await screen.findByTestId('venue-editor-form');
    fireEvent.click(screen.getByTestId('venue-save'));
    expect(await screen.findByText('Choose an area.')).toBeTruthy();
    expect(screen.getByText('Enter the venue name.')).toBeTruthy();
    expect(screen.getByText('Enter the address.')).toBeTruthy();
    expect(backend.callsTo('adminVenues.create')).toHaveLength(0);
  });

  it('shows the mapped error when the server refuses', async () => {
    const backend = createBackend({ me: meFor('city') });
    backend.failWith('adminVenues.create', 'conflict');
    renderScreen(<VenueEditorScreen />, { backend });
    await fillNewVenue();
    fireEvent.click(screen.getByTestId('venue-save'));
    expect(await screen.findByText(/clashes with something that already exists/)).toBeTruthy();
  });

  it('marks the field the server rejected', async () => {
    const backend = createBackend({ me: meFor('city') });
    backend.failWith('adminVenues.create', 'validation_failed', {
      issues: [{ path: 'address.en', code: 'too_big' }],
    });
    renderScreen(<VenueEditorScreen />, { backend });
    await fillNewVenue();
    fireEvent.click(screen.getByTestId('venue-save'));
    expect(await screen.findByText('This was not accepted. Check it and try again.')).toBeTruthy();
    expect(screen.getAllByText('This was not accepted. Check it and try again.')).toHaveLength(1);
  });

  it('does not let a venue coordinator add venues', async () => {
    const backend = createBackend({ me: meFor('venue') });
    renderScreen(<VenueEditorScreen />, { backend });
    expect(await screen.findByTestId('venue-editor-forbidden')).toBeTruthy();
    expect(screen.getByText('Your role cannot add venues.')).toBeTruthy();
    expect(screen.queryByTestId('venue-save')).toBeNull();
  });

  it('lets a national admin add a venue in any city', async () => {
    renderScreen(<VenueEditorScreen />, { backend: createBackend({ me: meFor('admin') }) });
    await screen.findByTestId('venue-editor-form');
    fireEvent.click(screen.getByTestId('venue-city'));
    expect(await screen.findByTestId(`venue-city-option-${ids.cityLahore}`)).toBeTruthy();
  });

  it('offers a city coordinator only their own city', async () => {
    renderScreen(<VenueEditorScreen />, { backend: createBackend({ me: meFor('city') }) });
    await screen.findByTestId('venue-editor-form');
    fireEvent.click(screen.getByTestId('venue-city'));
    await screen.findByTestId(`venue-city-option-${ids.cityRawalpindi}`);
    expect(screen.queryByTestId(`venue-city-option-${ids.cityLahore}`)).toBeNull();
  });
});

describe('VenueEditorScreen edit', () => {
  it('lets a venue coordinator change the facilities of their own venue and sends only the change', async () => {
    const backend = createBackend({ me: meFor('venue') });
    const { nav } = renderScreen(<VenueEditorScreen venueId={ids.venueAlNoor} />, { backend });
    await screen.findByTestId('venue-editor-form');
    // childFriendly starts false for Al-Noor.
    expect(screen.getByTestId('venue-facility-childFriendly').getAttribute('aria-checked')).toBe(
      'false',
    );
    fireEvent.click(screen.getByTestId('venue-facility-childFriendly'));
    fireEvent.click(screen.getByTestId('venue-save'));
    await waitFor(() => expect(nav.backs).toBe(1));
    expect(backend.callsTo('adminVenues.update')[0]!.body).toEqual({
      facilities: { childFriendly: true },
    });
    expect(backend.state.venues[0]!.facilities.childFriendly).toBe(true);
  });

  it.each([
    ['ur', RTL_UR],
    ['en', LTR_EN],
  ] as const)(
    'heads the profile with the name and address in the reader language (%s)',
    async (locale, combo) => {
      const backend = createBackend({ me: meFor('venue') });
      const venue = backend.state.venues.find((v) => v.id === ids.venueAlNoor)!;
      expect(venue.name.ur && venue.address.ur).toBeTruthy();
      renderScreen(<VenueEditorScreen venueId={ids.venueAlNoor} />, { backend, combo });
      await screen.findByTestId('venue-editor-form');
      const other = locale === 'ur' ? 'en' : 'ur';
      expect(screen.getByTestId('venue-profile-name').textContent).toBe(venue.name[locale]);
      expect(screen.getByTestId('venue-profile-address').textContent).toBe(venue.address[locale]);
      expect(screen.getByTestId('venue-profile-other-name').textContent).toBe(venue.name[other]);
    },
  );

  it('heads the profile with the English name on an Urdu screen when there is no Urdu name', async () => {
    const backend = createBackend({ me: meFor('venue') });
    const venue = backend.state.venues.find((v) => v.id === ids.venueAlNoor)!;
    venue.name = { en: venue.name.en, ur: null };
    // The public read answers from the contract's fixtures; the admin list holds this change.
    backend.failWith('venues.get', 'not_found');
    renderScreen(<VenueEditorScreen venueId={ids.venueAlNoor} />, { backend, combo: RTL_UR });
    await screen.findByTestId('venue-editor-form');
    expect(screen.getByTestId('venue-profile-name').textContent).toBe(venue.name.en);
    expect(screen.queryByTestId('venue-profile-other-name')).toBeNull();
  });

  it('says so when nothing changed', async () => {
    const backend = createBackend({ me: meFor('venue') });
    renderScreen(<VenueEditorScreen venueId={ids.venueAlNoor} />, { backend });
    await screen.findByTestId('venue-editor-form');
    fireEvent.click(screen.getByTestId('venue-save'));
    expect(await screen.findByTestId('venue-nothing')).toBeTruthy();
    expect(backend.callsTo('adminVenues.update')).toHaveLength(0);
  });

  it('keeps a venue coordinator out of another venue', async () => {
    const backend = createBackend({ me: meFor('venue') });
    renderScreen(<VenueEditorScreen venueId={ids.venueLahore} />, { backend });
    expect(await screen.findByTestId('venue-editor-forbidden')).toBeTruthy();
    expect(screen.getByText(/do not have permission/)).toBeTruthy();
    expect(screen.queryByTestId('venue-save')).toBeNull();
  });

  it('lets a city coordinator edit a venue of their city but not one of another city', async () => {
    const own = renderScreen(<VenueEditorScreen venueId={ids.venueAlNoor} />, {
      backend: createBackend({ me: meFor('city') }),
    });
    await screen.findByTestId('venue-editor-form');
    own.unmount();
    renderScreen(<VenueEditorScreen venueId={ids.venueLahore} />, {
      backend: createBackend({ me: meFor('city') }),
    });
    expect(await screen.findByTestId('venue-editor-forbidden')).toBeTruthy();
  });

  it('finds an archived venue through the admin list', async () => {
    const backend = createBackend({ me: meFor('admin') });
    backend.state.venues.find((v) => v.id === ids.venueAlNoor)!.status = 'archived';
    backend.failWith('venues.get', 'not_found');
    renderScreen(<VenueEditorScreen venueId={ids.venueAlNoor} />, { backend });
    await screen.findByTestId('venue-editor-form');
    expect(backend.callsTo('adminVenues.list').length).toBeGreaterThan(0);
  });

  it('shows an error state when the venue does not exist', async () => {
    renderScreen(<VenueEditorScreen venueId="00000000-0000-4000-8000-040000000999" />, {
      backend: createBackend({ me: meFor('admin') }),
    });
    expect(await screen.findByText(/could not find what you were looking for/)).toBeTruthy();
  });
});

describe('VenueEditorScreen circles at the venue', () => {
  it.each<RoleKind>(['venue', 'city', 'admin', 'multi'])(
    'lets a %s open a circle of the venue in the circle editor and start a new one there',
    async (kind) => {
      const backend = createBackend({ me: meFor(kind) });
      const circle = backend.state.circles.find((c) => c.venueId === ids.venueAlNoor)!;
      const { nav } = renderScreen(<VenueEditorScreen venueId={ids.venueAlNoor} />, { backend });
      const row = await screen.findByTestId(`venue-circle-${circle.id}`);
      fireEvent.click(row);
      fireEvent.click(screen.getByTestId('venue-new-circle'));
      expect(nav.pushed).toEqual([routes.circle(circle.id), routes.newCircle(ids.venueAlNoor)]);
      // Only this venue's circles are asked for and shown.
      expect(backend.callsTo('adminCircles.list').at(-1)!.query.venueId).toBe(ids.venueAlNoor);
      const other = backend.state.circles.find((c) => c.venueId !== ids.venueAlNoor)!;
      expect(screen.queryByTestId(`venue-circle-${other.id}`)).toBeNull();
    },
  );

  it('puts circles waiting for approval first, with their status', async () => {
    const backend = createBackend({ me: meFor('venue') });
    const published = backend.state.circles.find((c) => c.venueId === ids.venueAlNoor)!;
    backend.state.circles.push({
      ...published,
      id: '00000000-0000-4000-8000-0c0000000001',
      name: { en: 'A sample waiting circle', ur: null },
      status: 'pending_approval',
      approvedAt: null,
    });
    renderScreen(<VenueEditorScreen venueId={ids.venueAlNoor} />, { backend });
    await screen.findByTestId(`venue-circle-${published.id}`);
    const rows = screen.getAllByTestId(/^venue-circle-/);
    expect(rows[0]!.getAttribute('data-testid')).toBe(
      'venue-circle-00000000-0000-4000-8000-0c0000000001',
    );
    expect(within(rows[0]!).getByText('Waiting for approval')).toBeTruthy();
  });

  it('says when no circle meets at the venue yet', async () => {
    const backend = createBackend({ me: meFor('venue') });
    backend.state.circles = backend.state.circles.filter((c) => c.venueId !== ids.venueAlNoor);
    renderScreen(<VenueEditorScreen venueId={ids.venueAlNoor} />, { backend });
    expect(await screen.findByTestId('venue-circles-empty')).toBeTruthy();
    expect(screen.getByTestId('venue-new-circle')).toBeTruthy();
  });

  it('shows a retry inside the card when the circles cannot load, and keeps the form', async () => {
    const backend = createBackend({ me: meFor('venue') });
    backend.failWith('adminCircles.list', 'service_unavailable');
    renderScreen(<VenueEditorScreen venueId={ids.venueAlNoor} />, { backend });
    const retry = await within(await screen.findByTestId('venue-circles')).findByRole('button', {
      name: /try again/i,
    });
    expect(screen.getByTestId('venue-editor-form')).toBeTruthy();
    fireEvent.click(retry);
    await screen.findByTestId('venue-circles-data');
  });

  it('has no circles card while a new venue is being made', async () => {
    renderScreen(<VenueEditorScreen />, { backend: createBackend({ me: meFor('city') }) });
    await screen.findByTestId('venue-editor-form');
    expect(screen.queryByTestId('venue-circles')).toBeNull();
  });
});

describe.each(combos)('VenueEditorScreen circles in $name', (combo) => {
  it('shows the circles card in every direction, colour and size', async () => {
    const { container } = renderScreen(<VenueEditorScreen venueId={ids.venueAlNoor} />, {
      backend: createBackend({ me: meFor('venue') }),
      combo,
    });
    await screen.findByTestId('venue-circles-data');
    expect(container.querySelector('[dir]')?.getAttribute('dir')).toBe(combo.dir);
  });
});

describe('VenueEditorScreen location picker', () => {
  it('opens the map on the typed pin and brings the chosen place back to the form', async () => {
    renderScreen(<VenueEditorScreen />, { backend: createBackend({ me: meFor('city') }) });
    await fillNewVenue();
    fireEvent.click(screen.getByTestId('venue-pick-on-map'));
    expect(await screen.findByTestId('venue-location-map')).toBeTruthy();
    expect(screen.queryByTestId('venue-editor-form')).toBeNull();
    fireEvent.click(screen.getByTestId('venue-location-use'));
    await screen.findByTestId('venue-editor-form');
    // The map has not moved, so the pin is where it was typed.
    expect((screen.getByTestId('venue-lat') as HTMLInputElement).value).toBe('33.6');
    expect((screen.getByTestId('venue-lng') as HTMLInputElement).value).toBe('73.05');
  });

  it('goes back to the form without changing the pin on cancel', async () => {
    renderScreen(<VenueEditorScreen />, { backend: createBackend({ me: meFor('city') }) });
    await fillNewVenue();
    fireEvent.click(screen.getByTestId('venue-pick-on-map'));
    fireEvent.click(await screen.findByTestId('venue-location-cancel'));
    await screen.findByTestId('venue-editor-form');
    expect((screen.getByTestId('venue-lat') as HTMLInputElement).value).toBe('33.6');
  });
});
