import { fireEvent, within } from '@testing-library/react';
import { fixtures } from '@qc/contracts/fixtures';
import { describe, expect, it } from 'vitest';
import { messages } from '@qc/i18n';
import { SESSIONS } from '../test/factories';
import { MATRIX, directionOf, renderScreen, waitFor } from '../test/harness';
import { VenueScreen } from './VenueScreen';

const en = messages.en;
const ur = messages.ur;
const noor = fixtures.venues[0]!;
const darul = fixtures.venues[3]!;

describe('VenueScreen', () => {
  it('shows the venue, its address and its facilities as badges, with what is not listed in words', async () => {
    const view = await renderScreen(<VenueScreen venueId={noor.id} />);
    const list = await view.findByTestId('facilities');
    expect(view.getByRole('heading', { level: 1 }).textContent).toBe(noor.name.en);
    expect(view.getByText(noor.address.en)).toBeTruthy();
    // Masjid Al-Noor: women's section yes, parking yes, wudu yes, access yes, child friendly no.
    for (const key of ['womenSection', 'parking', 'wuduArea', 'elderWheelchairAccess'] as const) {
      expect(
        within(view.getByTestId(`facility-${key}`)).getByText(en[`facilities.${key}`]),
      ).toBeTruthy();
    }
    expect(view.queryByTestId('facility-childFriendly')).toBeNull();
    expect(view.getByTestId('facilities-missing').textContent).toContain(
      en['facilities.childFriendly'],
    );
    expect(within(list).getByText(noor.facilities.entranceNotes!.en)).toBeTruthy();
  });

  it('lets a screen reader read each facility badge as a list item with its words (A-02)', async () => {
    const view = await renderScreen(<VenueScreen venueId={noor.id} />);
    await view.findByTestId('facilities');
    const badge = view.getByTestId('facility-parking');
    expect(badge.getAttribute('role')).toBe('listitem');
    expect(badge.getAttribute('aria-label')).toBeNull();
    const words = within(badge).getByText(en['facilities.parking']);
    expect(words.closest('[aria-hidden="true"]')).toBeNull();
  });

  it('says "not listed" for what a venue lacks', async () => {
    const view = await renderScreen(<VenueScreen venueId={darul.id} />);
    await view.findByTestId('facilities');
    expect(view.getByTestId('facilities-missing').textContent).toContain(
      en['facilities.womenSection'],
    );
    expect(view.getByTestId('facility-parking')).toBeTruthy();
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

  it('shows a map card above Maps, Call and Follow that opens the full map on this venue', async () => {
    const view = await renderScreen(<VenueScreen venueId={noor.id} />);
    const card = await view.findByTestId('venue-map-card');
    const tiles = ['venue-location', 'venue-contact', 'venue-follow'].map((id) =>
      view.getByTestId(id),
    );
    // The map card comes first in the page, then the three tiles.
    for (const tile of tiles) {
      expect(card.compareDocumentPosition(tile) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    fireEvent.click(card);
    expect(view.world.nav.last()).toEqual({ type: 'go', route: { name: 'map', venueId: noor.id } });
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
      const words = locale === 'ur' ? ur : en;
      // A plain top bar with back; the name is the page's heading.
      expect(view.getByLabelText(words['ui.back'])).toBeTruthy();
      expect(view.getByTestId('venue-map-card')).toBeTruthy();
      expect(view.getByRole('heading', { level: 1 }).textContent).toBe(
        locale === 'ur' ? noor.name.ur : noor.name.en,
      );
      expect(view.getByText(words['facilities.wuduArea'])).toBeTruthy();
      expect(view.getAllByTestId(/^facility-/).length).toBe(4);
    });
  });
});
