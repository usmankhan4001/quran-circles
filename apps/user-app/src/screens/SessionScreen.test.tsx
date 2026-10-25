import { fireEvent, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { messages } from '@qc/i18n';
import { SESSIONS, registrationFor } from '../test/factories';
import { MATRIX, directionOf, expectGreenHeader, renderScreen, waitFor } from '../test/harness';
import { SessionScreen } from './SessionScreen';

const en = messages.en;

describe('SessionScreen', () => {
  it('shows when, how long, where, the facilities and the dates coming up', async () => {
    const s = SESSIONS.taraweeh;
    const view = await renderScreen(<SessionScreen sessionId={s.id} />);
    expect(await view.findByTestId('facilities')).toBeTruthy();
    expect(view.getAllByText(s.title.en).length).toBeGreaterThan(0);
    expect(view.getAllByText(/^Every day at 9:00\s?pm$/i).length).toBeGreaterThan(0);
    expect(
      view.getAllByText('0 minutes'.replace('0', String(s.durationMinutes))).length,
    ).toBeGreaterThan(0);
    const info = view.getByTestId('session-venue');
    expect(within(info).getByText(s.venue.name.en)).toBeTruthy();
    expect((await view.findAllByTestId(/^occurrence-/)).length).toBeGreaterThan(3);
  });

  it('offers Join as the main action and opens the join form', async () => {
    const s = SESSIONS.taraweeh;
    const view = await renderScreen(<SessionScreen sessionId={s.id} />, { signedIn: true });
    await view.findByTestId('facilities');
    const join = view.getByTestId('register-button');
    expect(join.textContent).toBe(en['session.join']);
    fireEvent.click(join);
    expect(view.world.nav.last()).toEqual({
      type: 'go',
      route: { name: 'register', sessionId: s.id },
    });
  });

  it('sends a guest to sign in first, and back to the join form after', async () => {
    const s = SESSIONS.taraweeh;
    const view = await renderScreen(<SessionScreen sessionId={s.id} />);
    await view.findByTestId('facilities');
    fireEvent.click(view.getByTestId('register-button'));
    expect(view.world.nav.last()).toEqual({
      type: 'go',
      route: { name: 'signIn', returnTo: { name: 'register', sessionId: s.id } },
    });
  });

  it('never talks about seats, even for a session with an old seat limit', async () => {
    const s = SESSIONS.womenFull;
    const view = await renderScreen(<SessionScreen sessionId={s.id} />, { signedIn: true });
    await view.findByTestId('facilities');
    expect(view.getByTestId('register-button').textContent).toBe(en['session.join']);
    expect(view.container.textContent ?? '').not.toMatch(/seat|full|waiting list/i);
  });

  it('shows that the person is joining and opens My Journey', async () => {
    const s = SESSIONS.taraweeh;
    const view = await renderScreen(<SessionScreen sessionId={s.id} />, {
      signedIn: true,
      mock: {
        handlers: {
          'registrations.listMine': () => ({ items: [registrationFor(s)], nextCursor: null }),
        },
      },
    });
    await waitFor(() =>
      expect(view.getByTestId('register-button').textContent).toBe(en['session.joined']),
    );
    fireEvent.click(view.getByTestId('register-button'));
    expect(view.world.nav.last()).toEqual({ type: 'tab', route: { name: 'journey' } });
  });

  it('offers Follow instead when the session takes no registrations', async () => {
    const s = SESSIONS.taraweeh;
    const walkIn = { ...s, registration: { ...s.registration, enabled: false } };
    const mock = { handlers: { 'sessions.get': () => walkIn } };
    const guest = await renderScreen(<SessionScreen sessionId={s.id} />, { mock });
    await guest.findByTestId('facilities');
    fireEvent.click(guest.getByTestId('register-button'));
    expect(await guest.findByTestId('join-halqa-sheet')).toBeTruthy();
    guest.unmount();

    const member = await renderScreen(<SessionScreen sessionId={s.id} />, {
      signedIn: true,
      mock,
    });
    await member.findByTestId('facilities');
    expect(member.getByTestId('register-button').textContent).toBe(en['venue.follow']);
    fireEvent.click(member.getByTestId('register-button'));
    expect(await member.findByText(new RegExp(en['venue.following'], 'i'))).toBeTruthy();
  });

  it('shows the circle, its teacher and the online link for a weekly circle', async () => {
    const s = SESSIONS.circle;
    const view = await renderScreen(<SessionScreen sessionId={s.id} />);
    await view.findByTestId('facilities');
    expect(view.getAllByText(s.circle!.name.en).length).toBeGreaterThan(0);
    expect(view.getByText(s.circle!.teacherName!)).toBeTruthy();
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

  it('shows a cancelled session as cancelled', async () => {
    const s = SESSIONS.taraweeh;
    const view = await renderScreen(<SessionScreen sessionId={s.id} />, {
      mock: { handlers: { 'sessions.get': () => ({ ...s, status: 'cancelled' }) } },
    });
    expect(await view.findByTestId('session-cancelled')).toBeTruthy();
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
      expect(view.getByTestId('register-button')).toBeTruthy();
      expect(view.getByTestId('facilities')).toBeTruthy();
    });
  });
});
