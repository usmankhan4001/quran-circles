import { fireEvent } from '@testing-library/react';
import { fixtures } from '@qc/contracts/fixtures';
import { describe, expect, it } from 'vitest';
import { messages } from '@qc/i18n';
import { SESSIONS, followFor, registrationFor } from '../test/factories';
import {
  MATRIX,
  createWorld,
  directionOf,
  expectGreenHeader,
  renderScreen,
  waitFor,
} from '../test/harness';
import { JourneyScreen } from './JourneyScreen';

const en = messages.en;
const ur = messages.ur;
const noor = fixtures.venues[0]!;
const REG_ID = '00000000-0000-4000-8000-0b0000000001';
const WAIT_ID = '00000000-0000-4000-8000-0b0000000002';

function mine(regs = [registrationFor(SESSIONS.taraweeh)], follows = [followFor(noor)]) {
  return {
    handlers: {
      'registrations.listMine': () => ({ items: regs, nextCursor: null }),
      'follows.list': () => ({ items: follows }),
    },
  };
}

describe('JourneyScreen', () => {
  it('asks a signed-out person to sign in and returns here afterwards', async () => {
    const view = await renderScreen(<JourneyScreen />);
    expect(view.getByTestId('journey-signed-out')).toBeTruthy();
    expect(view.getByText(en['journey.signIn.title'])).toBeTruthy();
    fireEvent.click(view.getByText(en['journey.signIn.action']));
    expect(view.world.nav.last()).toEqual({
      type: 'go',
      route: { name: 'signIn', returnTo: { name: 'journey' } },
    });
    expect(view.world.http.callsTo('GET /v1/registrations')).toHaveLength(0);
  });

  it('lets a screen reader read the summary numbers as text, with no name on a plain tile (A-02)', async () => {
    const world = await createWorld({ signedIn: true, mock: mine() });
    const view = await renderScreen(<JourneyScreen />, { world });
    await waitFor(() =>
      expect(view.getByTestId('journey-stat-upcoming').textContent).toContain('1'),
    );
    for (const [key, label] of [
      ['upcoming', en['journey.summary.upcoming']],
      ['waiting', en['journey.summary.waiting']],
      ['following', en['journey.summary.following']],
    ] as const) {
      const tile = view.getByTestId(`journey-stat-${key}`);
      // A name on an element with no role is ignored on the web (axe aria-prohibited-attr).
      expect(tile.getAttribute('aria-label')).toBeNull();
      expect(tile.querySelector('[aria-hidden="true"]')).toBeNull();
      expect(tile.textContent).toContain(label);
    }
  });

  it('lists registrations with their status and opens a session', async () => {
    const waitlisted = registrationFor(SESSIONS.womenFull, {
      id: WAIT_ID,
      status: 'waitlisted',
      waitlistPosition: 2,
    });
    const world = await createWorld({
      signedIn: true,
      mock: mine([registrationFor(SESSIONS.taraweeh), waitlisted]),
    });
    const view = await renderScreen(<JourneyScreen />, { world });
    expect(await view.findByTestId(`registration-${REG_ID}`)).toBeTruthy();
    expect(view.getByTestId(`registration-status-${REG_ID}`).textContent).toBe(
      en['journey.status.confirmed'],
    );
    expect(view.getByTestId(`registration-status-${WAIT_ID}`).textContent).toBe(
      en['journey.status.waitlisted'],
    );
    expect(
      view.getByText(`${en['registration.confirmation.position'].replace('{count}', '2')}`),
    ).toBeTruthy();
    // A waitlisted place gets no reminder switch: nothing is promised yet.
    expect(view.queryByTestId(`reminder-${SESSIONS.womenFull.id}`)).toBeNull();
    expect(view.getByTestId(`reminder-${SESSIONS.taraweeh.id}`)).toBeTruthy();
    fireEvent.click(view.getByTestId(`registration-${REG_ID}`));
    expect(world.nav.last()).toEqual({
      type: 'go',
      route: { name: 'session', sessionId: SESSIONS.taraweeh.id },
    });
    expect(world.http.callsTo('GET /v1/registrations')[0]!.search).toContain('upcomingOnly=true');
  });

  it('turns on a reminder only when the person asks, and plans it on the device', async () => {
    const world = await createWorld({ signedIn: true, mock: mine() });
    const view = await renderScreen(<JourneyScreen />, { world });
    const toggle = await view.findByTestId(`reminder-${SESSIONS.taraweeh.id}`);
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(world.scheduler.scheduled).toHaveLength(0);
    fireEvent.click(toggle);
    await waitFor(() => expect(world.scheduler.scheduled.length).toBeGreaterThan(0));
    expect(view.getByTestId(`reminder-${SESSIONS.taraweeh.id}`).getAttribute('aria-checked')).toBe(
      'true',
    );
    fireEvent.click(view.getByTestId(`reminder-${SESSIONS.taraweeh.id}`));
    await waitFor(() => expect(world.scheduler.scheduled).toHaveLength(0));
  });

  it('says so when reminders are not available here', async () => {
    const world = await createWorld({ signedIn: true, mock: mine() });
    world.scheduler.supported = false;
    const view = await renderScreen(<JourneyScreen />, { world });
    expect(await view.findByText(en['reminders.unsupported'])).toBeTruthy();
  });

  it('asks before cancelling, cancels, and shows the list again without it', async () => {
    const world = await createWorld({ signedIn: true, mock: mine() });
    const view = await renderScreen(<JourneyScreen />, { world });
    fireEvent.click(await view.findByTestId(`cancel-${REG_ID}`));
    expect(await view.findByTestId('cancel-sheet')).toBeTruthy();
    expect(world.http.callsTo('POST /v1/registrations')).toHaveLength(0);
    fireEvent.click(view.getByTestId('cancel-sheet-cancel'));
    await waitFor(() => expect(view.queryByTestId('cancel-sheet')).toBeNull());
    expect(world.http.callsTo('POST /v1/registrations')).toHaveLength(0);
  });

  it('cancels after the person confirms', async () => {
    const world = await createWorld({ signedIn: true, mock: mine() });
    const view = await renderScreen(<JourneyScreen />, { world });
    fireEvent.click(await view.findByTestId(`cancel-${REG_ID}`));
    fireEvent.click(await view.findByTestId('cancel-sheet-confirm'));
    await waitFor(() =>
      expect(world.http.callsTo(`POST /v1/registrations/${REG_ID}/cancel`)).toHaveLength(1),
    );
    expect(await view.findByText(en['journey.cancel.done'])).toBeTruthy();
  });

  it('keeps the sheet open with the reason when cancelling fails', async () => {
    const world = await createWorld({ signedIn: true, mock: mine() });
    world.http.failNext('POST /v1/registrations', 'internal_error');
    const view = await renderScreen(<JourneyScreen />, { world });
    fireEvent.click(await view.findByTestId(`cancel-${REG_ID}`));
    fireEvent.click(await view.findByTestId('cancel-sheet-confirm'));
    expect(
      await view.findByText(en[`errors.internal_error` as keyof typeof en], { exact: false }),
    ).toBeTruthy();
    expect(view.getByTestId('cancel-sheet')).toBeTruthy();
  });

  it('shows an empty state that leads to Nearby', async () => {
    const world = await createWorld({ signedIn: true, mock: mine([], []) });
    const view = await renderScreen(<JourneyScreen />, { world });
    expect(await view.findByTestId('journey-empty')).toBeTruthy();
    fireEvent.click(view.getByText(en['journey.registrations.empty.action']));
    expect(world.nav.last()).toEqual({ type: 'tab', route: { name: 'nearby' } });
    expect(view.getByText(en['journey.followed.empty'])).toBeTruthy();
  });

  it('lists followed venues, opens one, and stops following', async () => {
    const follow = followFor(noor);
    const world = await createWorld({ signedIn: true, mock: mine([], [follow]) });
    const view = await renderScreen(<JourneyScreen />, { world });
    fireEvent.click(await view.findByTestId(`follow-${follow.id}`));
    expect(world.nav.last()).toEqual({ type: 'go', route: { name: 'venue', venueId: noor.id } });
    fireEvent.click(view.getByTestId(`unfollow-${follow.id}`));
    await waitFor(() =>
      expect(world.http.callsTo(`DELETE /v1/me/follows/${follow.id}`)).toHaveLength(1),
    );
  });

  describe.each(MATRIX)('in $name', ({ locale, color, textSize }) => {
    it('draws registrations and follows', async () => {
      const world = await createWorld({ signedIn: true, locale, color, textSize, mock: mine() });
      const view = await renderScreen(<JourneyScreen />, { world });
      await view.findByTestId(`registration-${REG_ID}`);
      expect(directionOf(view.container)).toBe(locale === 'ur' ? 'rtl' : 'ltr');
      expectGreenHeader(view.container, color);
      const words = locale === 'ur' ? ur : en;
      expect(view.getByText(words['journey.registrations.title'])).toBeTruthy();
      expect(view.getByText(words['journey.status.confirmed'])).toBeTruthy();
    });
  });
});
