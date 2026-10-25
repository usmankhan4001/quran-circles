import { fireEvent, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { messages } from '@qc/i18n';
import { SESSIONS } from '../test/factories';
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

  it('opens the join bottom sheet for a guest follower', async () => {
    const s = SESSIONS.taraweeh;
    const view = await renderScreen(<SessionScreen sessionId={s.id} />);
    await view.findByTestId('facilities');
    const followBtn = view.getByTestId('register-button');
    expect(followBtn).toBeTruthy();
    fireEvent.click(followBtn);
    expect(await view.findByTestId('join-halqa-sheet')).toBeTruthy();
  });

  it('allows a signed-in person to toggle following for WhatsApp alerts', async () => {
    const s = SESSIONS.taraweeh;
    const view = await renderScreen(<SessionScreen sessionId={s.id} />, { signedIn: true });
    await view.findByTestId('facilities');
    const followBtn = view.getByTestId('register-button');
    fireEvent.click(followBtn);
    expect(await view.findByText(new RegExp(en['venue.following'], 'i'))).toBeTruthy();
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
