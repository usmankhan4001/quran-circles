import { fireEvent, within } from '@testing-library/react';
import { FIXTURE_NOW } from '@qc/contracts/fixtures';
import { describe, expect, it } from 'vitest';
import { messages } from '@qc/i18n';
import { CITY_RAWALPINDI, SESSIONS } from '../test/factories';
import { expectComingSoon } from '../test/comingSoon';
import { renderScreen, waitFor } from '../test/harness';
import { NearbyScreen } from './NearbyScreen';
import { SessionScreen } from './SessionScreen';

/**
 * Every feature that is drawn but has nothing behind it yet wears the one "Coming soon"
 * treatment (owner's decision, 25 Oct 2026): it stays on the screen with the badge, takes no
 * press, and screen readers hear it as turned off. The Ramadan row on Home is checked in
 * `HomeScreen.test.tsx`, the treatment itself in `ui/ComingSoon.test.tsx`.
 */

const LOCALES = ['en', 'ur'] as const;

/** `config.get` with only the circle requests flag on. */
const circleRequestsOn = {
  'config.get': () => ({
    seasonMode: 'dora',
    hijriOffsetDays: 0,
    featureFlags: {
      circle_requests: true,
      session_companion: false,
      invite_friends: false,
      poster_sharing: false,
      quran_offline_copy: false,
      whatsapp_fallback_reminders: false,
    },
    supportedLocales: ['en', 'ur'],
    minimumAppVersion: { ios: '1.0.0', android: '1.0.0' },
    serverTime: FIXTURE_NOW,
  }),
};

describe('Session page placeholders', () => {
  it('"Join online" without a link is not shown until there is a link', async () => {
    const s = SESSIONS.circle;
    expect(s.circle?.onlineLink).toBeNull();
    const view = await renderScreen(<SessionScreen sessionId={s.id} />);
    await view.findByTestId('facilities');
    expect(view.queryByTestId('session-online')).toBeNull();
  });

  it('"Join online" with a link stays a working link, with no badge', async () => {
    const s = SESSIONS.circle;
    const link = 'https://meet.example.org/circle';
    const view = await renderScreen(<SessionScreen sessionId={s.id} />, {
      mock: {
        handlers: { 'sessions.get': () => ({ ...s, circle: { ...s.circle!, onlineLink: link } }) },
      },
    });
    await view.findByTestId('facilities');
    const online = view.getByTestId('session-online');
    expect(online.getAttribute('aria-disabled')).toBeNull();
    expect(online.textContent).not.toContain(messages.en['comingSoon.badge']);
    fireEvent.click(online);
    await waitFor(() => expect(view.world.opened).toEqual([link]));
  });

  it('the host row is left out when no teacher is known', async () => {
    const s = SESSIONS.taraweeh;
    expect(s.circle).toBeNull();
    const view = await renderScreen(<SessionScreen sessionId={s.id} />);
    await view.findByTestId('facilities');
    expect(view.queryByTestId('session-circle')).toBeNull();
    expect(view.queryByText(messages.en['session.host.unknown'])).toBeNull();
  });

  it("shows the teacher's name as it is, with no badge, when the circle has one", async () => {
    const s = SESSIONS.circle;
    const view = await renderScreen(<SessionScreen sessionId={s.id} />);
    await view.findByTestId('facilities');
    expect(view.getByTestId('session-circle')).toBeTruthy();
    expect(view.getByText(s.circle!.teacherName!)).toBeTruthy();
  });
});

describe('Nearby placeholders (request a circle, flag on)', () => {
  it.each(LOCALES)(
    '"Ask for a circle" at the end of the list is coming soon (%s)',
    async (locale) => {
      const words = messages[locale];
      const view = await renderScreen(<NearbyScreen />, {
        locale,
        cityId: CITY_RAWALPINDI.id,
        mock: { handlers: circleRequestsOn },
      });
      const ask = await view.findByTestId('nearby-ask-action');
      expectComingSoon(ask, words['nearby.ask.action'], locale, { role: 'button' });
      expect(ask.textContent).toContain(words['nearby.ask.action']);
      fireEvent.click(ask);
      expect(view.queryByText(words['nearby.request.soon'])).toBeNull();
      expect(view.world.nav.last()).toBeUndefined();
    },
  );

  it.each(LOCALES)(
    '"Request a circle near me" on the empty list is coming soon (%s)',
    async (locale) => {
      const words = messages[locale];
      const view = await renderScreen(<NearbyScreen />, {
        locale,
        cityId: CITY_RAWALPINDI.id,
        mock: {
          handlers: {
            ...circleRequestsOn,
            'sessions.list': () => ({ items: [], nextCursor: null }),
          },
        },
      });
      const empty = await view.findByTestId('nearby-empty');
      const request = await within(empty).findByTestId('nearby-request');
      expectComingSoon(request, words['nearby.request.action'], locale, { role: 'button' });
      fireEvent.click(request);
      expect(view.queryByText(words['nearby.request.soon'])).toBeNull();
      // It is not offered as a working button of the empty state any more.
      expect(
        within(empty).queryByRole('button', { name: words['nearby.request.action'] }),
      ).toBeNull();
    },
  );
});
