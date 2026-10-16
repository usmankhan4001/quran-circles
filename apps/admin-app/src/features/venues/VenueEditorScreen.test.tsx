import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import * as fx from '@qc/contracts/fixtures';
import { createBackend, ids, meFor } from '../../test/backend';
import { combos, renderScreen, typeInto } from '../../test/render';
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
