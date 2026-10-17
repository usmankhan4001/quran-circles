import { fireEvent, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { messages } from '@qc/i18n';
import { SESSIONS, registrationFor } from '../test/factories';
import {
  MATRIX,
  createWorld,
  directionOf,
  expectGreenHeader,
  renderScreen,
  waitFor,
} from '../test/harness';
import { SessionScreen } from './SessionScreen';

const en = messages.en;
const ur = messages.ur;

describe('SessionScreen', () => {
  it('shows when, how long, where, the facilities and the dates coming up', async () => {
    const s = SESSIONS.taraweeh;
    const view = await renderScreen(<SessionScreen sessionId={s.id} />);
    expect(await view.findByTestId('facilities')).toBeTruthy();
    expect(view.getAllByText(s.title.en).length).toBeGreaterThan(0);
    expect(view.getByText(/^Every day at 9:00\s?pm$/i)).toBeTruthy();
    expect(view.getByText('0 minutes'.replace('0', String(s.durationMinutes)))).toBeTruthy();
    expect(view.getByText(en['session.registration.open'])).toBeTruthy();
    const info = view.getByTestId('session-venue');
    expect(within(info).getByText(s.venue.name.en)).toBeTruthy();
    expect((await view.findAllByTestId(/^occurrence-/)).length).toBeGreaterThan(3);
  });

  it('tells the number of seats left when the session has a limit', async () => {
    const lecture = SESSIONS.lecture;
    const view = await renderScreen(<SessionScreen sessionId={lecture.id} />);
    const left = lecture.registration.capacity! - lecture.registration.seatsTaken!;
    expect(await view.findByText(`${left} seats left`)).toBeTruthy();
  });

  it('offers the waiting list on a full session', async () => {
    const view = await renderScreen(<SessionScreen sessionId={SESSIONS.womenFull.id} />);
    expect(await view.findByText(en['session.registration.fullWaitlist'])).toBeTruthy();
    expect(view.getByTestId('register-button').textContent).toBe(en['session.waitlist']);
  });

  it('opens the registration form for a signed-in person', async () => {
    const s = SESSIONS.taraweeh;
    const view = await renderScreen(<SessionScreen sessionId={s.id} />, { signedIn: true });
    await view.findByTestId('facilities');
    fireEvent.click(view.getByTestId('register-button'));
    expect(view.world.nav.last()).toEqual({
      type: 'go',
      route: { name: 'register', sessionId: s.id },
    });
  });

  it('asks a signed-out person to sign in first and then brings them back to registering', async () => {
    const s = SESSIONS.taraweeh;
    const view = await renderScreen(<SessionScreen sessionId={s.id} />);
    await view.findByTestId('facilities');
    fireEvent.click(view.getByTestId('register-button'));
    expect(view.world.nav.last()).toEqual({
      type: 'go',
      route: { name: 'signIn', returnTo: { name: 'register', sessionId: s.id } },
    });
  });

  it('shows a registered person that they are registered, and where to see it', async () => {
    const s = SESSIONS.taraweeh;
    const world = await createWorld({
      signedIn: true,
      mock: {
        handlers: {
          'registrations.listMine': () => ({ items: [registrationFor(s)], nextCursor: null }),
        },
      },
    });
    const view = await renderScreen(<SessionScreen sessionId={s.id} />, { world });
    await waitFor(() =>
      expect(view.getByTestId('register-button').textContent).toBe(en['session.alreadyRegistered']),
    );
    fireEvent.click(view.getByTestId('register-button'));
    expect(world.nav.last()).toEqual({ type: 'tab', route: { name: 'journey' } });
  });

  it('shows the circle, its teacher and the online link for a weekly circle', async () => {
    const s = SESSIONS.circle;
    const view = await renderScreen(<SessionScreen sessionId={s.id} />);
    await view.findByTestId('facilities');
    expect(view.getAllByText(s.circle!.name.en).length).toBeGreaterThan(0);
    expect(view.getByText(`Teacher: ${s.circle!.teacherName}`)).toBeTruthy();
    if (s.circle!.onlineLink) {
      fireEvent.click(view.getByText(en['session.online']));
      await waitFor(() => expect(view.world.opened).toEqual([s.circle!.onlineLink]));
    }
  });

  it('opens the venue page', async () => {
    const s = SESSIONS.taraweeh;
    const view = await renderScreen(<SessionScreen sessionId={s.id} />);
    fireEvent.click(await view.findByTestId('session-venue'));
    expect(view.world.nav.last()).toEqual({
      type: 'go',
      route: { name: 'venue', venueId: s.venueId },
    });
  });

  it('shows a cancelled session as cancelled and cannot be registered for', async () => {
    const s = SESSIONS.taraweeh;
    const view = await renderScreen(<SessionScreen sessionId={s.id} />, {
      mock: { handlers: { 'sessions.get': () => ({ ...s, status: 'cancelled' }) } },
    });
    await view.findByTestId('facilities').catch(() => undefined);
    const button = await view.findByTestId('register-button');
    expect(button.textContent).toBe(en['session.cancelled']);
    expect(button.getAttribute('aria-disabled')).toBe('true');
  });

  describe.each(MATRIX)('in $name', ({ locale, color, textSize }) => {
    it('draws the session', async () => {
      const s = SESSIONS.taraweeh;
      const view = await renderScreen(<SessionScreen sessionId={s.id} />, {
        locale,
        color,
        textSize,
      });
      await view.findByTestId('facilities');
      expect(directionOf(view.container)).toBe(locale === 'ur' ? 'rtl' : 'ltr');
      expectGreenHeader(view.container, color);
      const words = locale === 'ur' ? ur : en;
      expect(view.getByText(words['session.register'])).toBeTruthy();
      expect(view.getByText(words['venue.facilities.title'])).toBeTruthy();
    });
  });
});
