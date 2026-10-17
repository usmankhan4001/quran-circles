import { fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { messages } from '@qc/i18n';
import { ERROR_CODES, makeApiError, type Consent, type ProfileUpdate } from '@qc/contracts';
import { fixtures } from '@qc/contracts/fixtures';
import { MATRIX, createWorld, directionOf, renderScreen, waitFor } from '../test/harness';
import { ALL_NEXT_FLAGS, configWith, meWith, type Handlers } from '../test/nextFeatures';
import { ProfileScreen } from './ProfileScreen';

const en = messages.en;
const ur = messages.ur;

const AYAH_ROW: Consent = {
  id: '00000000-0000-4000-8000-0c0000000010',
  channel: 'push',
  purpose: 'ayah_daily',
  venueId: null,
  grantedAt: '2027-02-10T08:00:00Z',
  revokedAt: '2027-02-12T08:00:00Z',
};

/** `me.update` that keeps what was sent, like the server does. */
const echoProfile: Handlers = {
  'me.update': (c: unknown) => {
    const body = (c as { body: ProfileUpdate }).body;
    return { ...fixtures.me, profile: { ...fixtures.me.profile, ...body } };
  },
};

function errorAnswer(code: keyof typeof ERROR_CODES) {
  return (_c: unknown, id: string) =>
    new Response(JSON.stringify(makeApiError(code, id)), {
      status: ERROR_CODES[code],
      headers: { 'content-type': 'application/json' },
    });
}

async function profile(handlers: Handlers = {}, consents: Consent[] = []) {
  const view = await renderScreen(<ProfileScreen />, {
    signedIn: true,
    mock: {
      handlers: {
        'follows.list': () => ({ items: [] }),
        'consents.list': () => ({ items: consents }),
        ...echoProfile,
        ...handlers,
      },
    },
  });
  await view.findByTestId('profile-account');
  return view;
}

describe('Profile: daily goal (reading_days)', () => {
  it('sets a goal and saves it on the profile', async () => {
    const view = await profile();
    fireEvent.click(await view.findByTestId('profile-goal'));
    fireEvent.click(await view.findByTestId('profile-goal-option-pages:2'));
    await waitFor(() =>
      expect(view.world.http.callsTo('PATCH /v1/me')[0]?.body).toEqual({
        dailyGoal: { unit: 'pages', amount: 2 },
      }),
    );
    await waitFor(() =>
      expect(view.getByTestId('profile-goal').getAttribute('aria-label')).toBe(
        `${en['profile.goal.label']}, ${en['profile.goal.option'].replace('{goal}', '2 pages')}`,
      ),
    );
  });

  it('removes the goal with "No goal"', async () => {
    const view = await profile(meWith({ dailyGoal: { unit: 'minutes', amount: 10 } }));
    await waitFor(() =>
      expect(view.getByTestId('profile-goal').getAttribute('aria-label')).toContain('10 minutes'),
    );
    fireEvent.click(view.getByTestId('profile-goal'));
    fireEvent.click(await view.findByTestId('profile-goal-option-none'));
    await waitFor(() =>
      expect(view.world.http.callsTo('PATCH /v1/me')[0]?.body).toEqual({ dailyGoal: null }),
    );
  });

  it('shows the error when the goal cannot be saved', async () => {
    const view = await profile({ 'me.update': errorAnswer('internal_error') });
    fireEvent.click(await view.findByTestId('profile-goal'));
    fireEvent.click(await view.findByTestId('profile-goal-option-rukus:1'));
    expect((await view.findByTestId('profile-reading-error')).textContent).toBe(
      en['errors.internal_error'],
    );
  });
});

describe('Profile: revise after (memorisation)', () => {
  it('shows the default of 14 days and saves a new setting', async () => {
    const view = await profile();
    await waitFor(() =>
      expect(view.getByTestId('profile-revise-after').getAttribute('aria-label')).toBe(
        `${en['profile.reviseAfter.label']}, 14 days`,
      ),
    );
    fireEvent.click(view.getByTestId('profile-revise-after'));
    fireEvent.click(await view.findByTestId('profile-revise-after-option-7'));
    await waitFor(() =>
      expect(view.world.http.callsTo('PATCH /v1/me')[0]?.body).toEqual({
        memorisationReviseAfterDays: 7,
      }),
    );
  });

  it('saves the default as null, which means "the default"', async () => {
    const view = await profile(meWith({ memorisationReviseAfterDays: 30 }));
    await waitFor(() =>
      expect(view.getByTestId('profile-revise-after').getAttribute('aria-label')).toContain('30'),
    );
    fireEvent.click(view.getByTestId('profile-revise-after'));
    fireEvent.click(await view.findByTestId('profile-revise-after-option-14'));
    await waitFor(() =>
      expect(view.world.http.callsTo('PATCH /v1/me')[0]?.body).toEqual({
        memorisationReviseAfterDays: null,
      }),
    );
  });

  it('shows only the settings whose feature is on, and none with both off', async () => {
    const goalOnly = await profile(configWith(['reading_days']));
    await goalOnly.findByTestId('profile-goal');
    expect(goalOnly.queryByTestId('profile-revise-after')).toBeNull();
    goalOnly.unmount();

    const none = await profile(
      configWith(ALL_NEXT_FLAGS.filter((f) => f !== 'reading_days' && f !== 'memorisation')),
    );
    await waitFor(() =>
      expect(none.world.http.callsTo('GET /v1/config').length).toBeGreaterThan(0),
    );
    await none.findByTestId('profile-notifications');
    expect(none.queryByTestId('profile-reading')).toBeNull();
  });
});

describe('Profile: ayah of the day notification (ayah_of_the_day)', () => {
  it('is on when there is no row, and turning it off writes push / ayah_daily', async () => {
    const view = await profile();
    const toggle = await view.findByTestId('profile-ayah-push');
    await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('true'));
    await waitFor(() => expect(toggle.getAttribute('aria-disabled')).not.toBe('true'));
    fireEvent.click(toggle);
    await waitFor(() =>
      expect(view.world.http.callsTo('PUT /v1/me/consents')[0]?.body).toEqual({
        channel: 'push',
        purpose: 'ayah_daily',
        granted: false,
      }),
    );
  });

  it('is off after the person revoked it, and turning it on grants it again', async () => {
    const view = await profile({}, [AYAH_ROW]);
    const toggle = await view.findByTestId('profile-ayah-push');
    await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('false'));
    await waitFor(() => expect(toggle.getAttribute('aria-disabled')).not.toBe('true'));
    fireEvent.click(toggle);
    await waitFor(() =>
      expect(view.world.http.callsTo('PUT /v1/me/consents')[0]?.body).toEqual({
        channel: 'push',
        purpose: 'ayah_daily',
        granted: true,
      }),
    );
  });

  it('ignores consents for other purposes', async () => {
    const other: Consent = { ...AYAH_ROW, purpose: 'announcements', channel: 'push' };
    const view = await profile({}, [other]);
    const toggle = await view.findByTestId('profile-ayah-push');
    await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('true'));
  });

  it('shows the error when the change fails', async () => {
    const view = await profile({ 'consents.set': errorAnswer('internal_error') });
    const toggle = await view.findByTestId('profile-ayah-push');
    await waitFor(() => expect(toggle.getAttribute('aria-disabled')).not.toBe('true'));
    fireEvent.click(toggle);
    expect((await view.findByTestId('profile-ayah-push-error')).textContent).toBe(
      en['errors.internal_error'],
    );
  });

  it('is not shown with the flag off', async () => {
    const view = await profile(configWith(['reading_days']));
    await view.findByTestId('profile-goal');
    expect(view.queryByTestId('profile-ayah-push')).toBeNull();
  });
});

describe.each(MATRIX)('Profile reading settings in $name', ({ locale, color, textSize }) => {
  it('draws the reading section and the ayah switch', async () => {
    const world = await createWorld({
      signedIn: true,
      locale,
      color,
      textSize,
      mock: {
        handlers: { 'follows.list': () => ({ items: [] }), 'consents.list': () => ({ items: [] }) },
      },
    });
    const view = await renderScreen(<ProfileScreen />, { world });
    await view.findByTestId('profile-goal');
    await view.findByTestId('profile-ayah-push');
    const words = locale === 'ur' ? ur : en;
    expect(directionOf(view.container)).toBe(locale === 'ur' ? 'rtl' : 'ltr');
    expect(view.getByText(words['profile.reading.title'])).toBeTruthy();
    expect(view.getByText(words['profile.goal.label'])).toBeTruthy();
    expect(view.getByText(words['profile.reviseAfter.label'])).toBeTruthy();
    expect(view.getByText(words['profile.ayahPush.label'])).toBeTruthy();
  });
});
