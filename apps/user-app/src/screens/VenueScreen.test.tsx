import { fireEvent, within } from '@testing-library/react';
import { fixtures } from '@qc/contracts/fixtures';
import { describe, expect, it } from 'vitest';
import { messages } from '@qc/i18n';
import { SESSIONS } from '../test/factories';
import { MATRIX, directionOf, expectGreenHeader, renderScreen, waitFor } from '../test/harness';
import { VenueScreen } from './VenueScreen';

const en = messages.en;
const ur = messages.ur;
const noor = fixtures.venues[0]!;
const darul = fixtures.venues[3]!;

describe('VenueScreen', () => {
  it('shows the venue, its address and the fixed facilities checklist in words', async () => {
    const view = await renderScreen(<VenueScreen venueId={noor.id} />);
    const list = await view.findByTestId('facilities');
    expect(view.getAllByText(noor.name.en).length).toBeGreaterThan(0);
    expect(view.getByText(noor.address.en)).toBeTruthy();
    // Masjid Al-Noor: women's section yes, parking yes, wudu yes, access yes, child friendly no.
    const row = (key: string) => within(view.getByTestId(`facility-${key}`));
    expect(row('womenSection').getByText(en['facilities.available'])).toBeTruthy();
    expect(row('parking').getByText(en['facilities.available'])).toBeTruthy();
    expect(row('childFriendly').getByText(en['facilities.notListed'])).toBeTruthy();
    expect(within(list).getByText(en['facilities.womenSection'])).toBeTruthy();
    expect(within(list).getByText(en['facilities.wuduArea'])).toBeTruthy();
    expect(within(list).getByText(noor.facilities.entranceNotes!.en)).toBeTruthy();
  });

  it('lets a screen reader read each facility line as text, with no name on a plain row (A-02)', async () => {
    const view = await renderScreen(<VenueScreen venueId={noor.id} />);
    await view.findByTestId('facilities');
    for (const key of [
      'womenSection',
      'parking',
      'wuduArea',
      'elderWheelchairAccess',
      'childFriendly',
    ] as const) {
      const row = view.getByTestId(`facility-${key}`);
      // A name on an element with no role is ignored on the web (axe aria-prohibited-attr).
      expect(row.getAttribute('aria-label')).toBeNull();
      expect(row.getAttribute('role')).toBeNull();
      // The words are not hidden: they are what is read. Only the icon is decoration.
      const words = within(row).getByText(en[`facilities.${key}`]);
      expect(words.closest('[aria-hidden="true"]')).toBeNull();
      const state =
        within(row).queryByText(en['facilities.available']) ??
        within(row).getByText(en['facilities.notListed']);
      expect(state.closest('[aria-hidden="true"]')).toBeNull();
    }
  });

  it('says "not listed" for what a venue lacks', async () => {
    const view = await renderScreen(<VenueScreen venueId={darul.id} />);
    await view.findByTestId('facilities');
    expect(
      within(view.getByTestId('facility-womenSection')).getByText(en['facilities.notListed']),
    ).toBeTruthy();
    expect(
      within(view.getByTestId('facility-parking')).getByText(en['facilities.available']),
    ).toBeTruthy();
  });

  it('lists the sessions at the venue and opens one', async () => {
    const view = await renderScreen(<VenueScreen venueId={noor.id} />);
    const card = await view.findByTestId(`session-card-${SESSIONS.taraweeh.id}`);
    fireEvent.click(card);
    expect(view.world.nav.last()).toEqual({
      type: 'go',
      route: { name: 'session', sessionId: SESSIONS.taraweeh.id },
    });
    expect(view.world.http.callsTo('GET /v1/sessions')[0]!.search).toContain(`venueId=${noor.id}`);
  });

  it('opens the phone and the map from the buttons', async () => {
    const view = await renderScreen(<VenueScreen venueId={noor.id} />);
    fireEvent.click(await view.findByTestId('venue-contact'));
    fireEvent.click(view.getByTestId('venue-location'));
    await waitFor(() => expect(view.world.opened).toHaveLength(2));
    expect(view.world.opened[0]).toBe(`tel:${noor.contactPhone}`);
    expect(view.world.opened[1]).toContain('google.com/maps');
    expect(view.world.opened[1]).toContain(`${noor.lat},${noor.lng}`);
  });

  it('follows the venue for a signed-in person', async () => {
    const view = await renderScreen(<VenueScreen venueId={noor.id} />, { signedIn: true });
    fireEvent.click(await view.findByTestId('venue-follow'));
    await waitFor(() => expect(view.world.http.callsTo('POST /v1/me/follows')).toHaveLength(1));
    expect(view.world.http.callsTo('POST /v1/me/follows')[0]!.body).toMatchObject({
      target: 'venue',
      venueId: noor.id,
    });
  });

  it('sends a signed-out person to sign in and back before following', async () => {
    const view = await renderScreen(<VenueScreen venueId={noor.id} />);
    fireEvent.click(await view.findByTestId('venue-follow'));
    expect(view.world.nav.last()).toEqual({
      type: 'go',
      route: { name: 'signIn', returnTo: { name: 'venue', venueId: noor.id } },
    });
    expect(view.world.http.callsTo('POST /v1/me/follows')).toHaveLength(0);
  });

  it('says what happened when the venue cannot be found', async () => {
    const view = await renderScreen(<VenueScreen venueId="00000000-0000-4000-8000-0000000000ff" />);
    expect(await view.findByText(en['errors.not_found'])).toBeTruthy();
  });

  describe.each(MATRIX)('in $name', ({ locale, color, textSize }) => {
    it('draws the venue and the checklist', async () => {
      const view = await renderScreen(<VenueScreen venueId={noor.id} />, {
        locale,
        color,
        textSize,
      });
      await view.findByTestId('facilities');
      expect(directionOf(view.container)).toBe(locale === 'ur' ? 'rtl' : 'ltr');
      expectGreenHeader(view.container, color);
      const words = locale === 'ur' ? ur : en;
      expect(view.getByText(words['facilities.wuduArea'])).toBeTruthy();
      expect(view.getAllByText(words['facilities.available']).length).toBe(4);
    });
  });
});
