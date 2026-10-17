import { fireEvent } from '@testing-library/react';
import { fixtures } from '@qc/contracts/fixtures';
import { describe, expect, it } from 'vitest';
import { messages } from '@qc/i18n';
import { TOKENS_KEY } from '../auth/session';
import { followFor } from '../test/factories';
import {
  MATRIX,
  createWorld,
  directionOf,
  expectGreenHeader,
  renderScreen,
  waitFor,
} from '../test/harness';
import { ProfileScreen } from './ProfileScreen';

const en = messages.en;
const ur = messages.ur;
const noor = fixtures.venues[0]!;
const FOLLOW = followFor(noor);
const CONSENT = {
  id: '00000000-0000-4000-8000-0c0000000009',
  channel: 'whatsapp' as const,
  purpose: 'session_reminders' as const,
  venueId: null,
  grantedAt: '2027-02-10T08:00:00Z',
  revokedAt: null,
};

function mine(consents: (typeof CONSENT)[] = [], follows = [FOLLOW]) {
  return {
    handlers: {
      'follows.list': () => ({ items: follows }),
      'consents.list': () => ({ items: consents }),
    },
  };
}

async function open(options: Parameters<typeof createWorld>[0] = {}) {
  const world = await createWorld({ signedIn: true, mock: mine(), ...options });
  const view = await renderScreen(<ProfileScreen />, { world });
  await view.findByTestId('profile-account');
  return { world, view };
}

describe('ProfileScreen', () => {
  it('offers sign in to a signed-out person but still lets them choose language and size', async () => {
    const view = await renderScreen(<ProfileScreen />);
    fireEvent.click(view.getByTestId('profile-sign-in'));
    expect(view.world.nav.last()).toEqual({
      type: 'go',
      route: { name: 'signIn', returnTo: { name: 'profile' } },
    });
    expect(view.getByTestId('profile-language')).toBeTruthy();
    expect(view.queryByTestId('profile-notifications')).toBeNull();
    expect(view.queryByTestId('profile-delete')).toBeNull();
  });

  it('shows the account with the number written for reading', async () => {
    const { view } = await open();
    expect(view.getByTestId('profile-phone').textContent).toMatch(/^\+92 3\d\d \d{7}$/);
    expect((view.getByTestId('profile-name') as HTMLInputElement).value).toBe(
      fixtures.me.displayName,
    );
  });

  it('changes the language at once, and keeps it for the account', async () => {
    const { world, view } = await open();
    fireEvent.click(view.getByTestId('profile-language-ur'));
    await waitFor(() => expect(world.services.preferences.get().locale).toBe('ur'));
    await waitFor(() => expect(world.http.callsTo('PATCH /v1/me')).toHaveLength(1));
    expect(world.http.callsTo('PATCH /v1/me')[0]!.body).toEqual({ locale: 'ur' });
    expect(await view.findByText(ur['profile.title'])).toBeTruthy();
    expect(directionOf(view.container)).toBe('rtl');
  });

  it('changes the text size and the appearance', async () => {
    const { world, view } = await open();
    fireEvent.click(view.getByTestId('profile-text-size-3'));
    fireEvent.click(view.getByTestId('profile-appearance-dark'));
    await waitFor(() => expect(world.services.preferences.get().textSize).toBe(3));
    expect(world.services.preferences.get().color).toBe('dark');
  });

  it('saves a new name, and refuses an empty one', async () => {
    const { world, view } = await open();
    fireEvent.change(view.getByTestId('profile-name'), { target: { value: ' ' } });
    fireEvent.click(view.getByTestId('profile-name-save'));
    expect(await view.findByText(en['signIn.problem.name'])).toBeTruthy();
    expect(world.http.callsTo('PATCH /v1/me')).toHaveLength(0);
    fireEvent.change(view.getByTestId('profile-name'), { target: { value: 'Maryam Noor' } });
    fireEvent.click(view.getByTestId('profile-name-save'));
    await waitFor(() => expect(world.http.callsTo('PATCH /v1/me')).toHaveLength(1));
    expect(world.http.callsTo('PATCH /v1/me')[0]!.body).toEqual({ displayName: 'Maryam Noor' });
  });

  it('turns alerts on and off for each followed venue', async () => {
    const { world, view } = await open();
    const toggle = await view.findByTestId(`alerts-${FOLLOW.id}`);
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(toggle);
    await waitFor(() =>
      expect(world.http.callsTo(`PATCH /v1/me/follows/${FOLLOW.id}`)).toHaveLength(1),
    );
    expect(world.http.callsTo(`PATCH /v1/me/follows/${FOLLOW.id}`)[0]!.body).toEqual({
      alertsEnabled: false,
    });
  });

  it('says so when no venue is followed', async () => {
    const { view } = await open({ mock: mine([], []) });
    expect(await view.findByText(en['profile.alerts.empty'])).toBeTruthy();
  });

  it('grants and revokes WhatsApp messages with one switch', async () => {
    const off = await open();
    await waitFor(() =>
      expect(off.view.getByTestId('profile-whatsapp').getAttribute('aria-disabled')).not.toBe(
        'true',
      ),
    );
    fireEvent.click(off.view.getByTestId('profile-whatsapp'));
    await waitFor(() => expect(off.world.http.callsTo('PUT /v1/me/consents')).toHaveLength(1));
    expect(off.world.http.callsTo('PUT /v1/me/consents')[0]!.body).toMatchObject({
      channel: 'whatsapp',
      purpose: 'session_reminders',
      granted: true,
    });
    off.view.unmount();

    const on = await open({ mock: mine([CONSENT]) });
    await waitFor(() =>
      expect(on.view.getByTestId('profile-whatsapp').getAttribute('aria-checked')).toBe('true'),
    );
    fireEvent.click(on.view.getByTestId('profile-whatsapp'));
    await waitFor(() => expect(on.world.http.callsTo('PUT /v1/me/consents')).toHaveLength(1));
    expect(on.world.http.callsTo('PUT /v1/me/consents')[0]!.body).toMatchObject({ granted: false });
  });

  it('turns on push alerts when the device allows them, and says when it does not', async () => {
    const { world, view } = await open();
    fireEvent.click(view.getByTestId('profile-push'));
    await waitFor(() => expect(world.http.callsTo('PUT /v1/me/devices')).toHaveLength(1));
    await waitFor(() =>
      expect(view.getByTestId('profile-push').getAttribute('aria-checked')).toBe('true'),
    );
    view.unmount();

    const denied = await open();
    denied.world.registrar.result = 'denied';
    fireEvent.click(denied.view.getByTestId('profile-push'));
    expect(await denied.view.findByText(en['profile.push.denied'])).toBeTruthy();
    expect(denied.world.http.callsTo('PUT /v1/me/devices')).toHaveLength(0);
  });

  it('signs out, clears the device and goes Home', async () => {
    const { world, view } = await open();
    expect(await world.tokenStore.get(TOKENS_KEY)).not.toBeNull();
    fireEvent.click(view.getByTestId('profile-sign-out'));
    await waitFor(() => expect(world.services.auth.getState().status).toBe('signedOut'));
    expect(world.nav.last()).toEqual({ type: 'tab', route: { name: 'home' } });
    expect(await world.tokenStore.get(TOKENS_KEY)).toBeNull();
  });

  it('asks before deleting the account, and keeps it when the person says no', async () => {
    const { world, view } = await open();
    fireEvent.click(view.getByTestId('profile-delete'));
    expect(await view.findByTestId('delete-sheet')).toBeTruthy();
    expect(world.http.callsTo('DELETE /v1/me')).toHaveLength(0);
    fireEvent.click(view.getByTestId('delete-sheet-cancel'));
    await waitFor(() => expect(view.queryByTestId('delete-sheet')).toBeNull());
    expect(world.http.callsTo('DELETE /v1/me')).toHaveLength(0);
    expect(world.services.auth.getState().status).toBe('signedIn');
  });

  it('deletes the account after confirming, then clears everything on the device', async () => {
    const { world, view } = await open();
    fireEvent.click(view.getByTestId('profile-delete'));
    fireEvent.click(await view.findByTestId('delete-sheet-confirm'));
    await waitFor(() => expect(world.http.callsTo('DELETE /v1/me')).toHaveLength(1));
    expect(world.http.callsTo('DELETE /v1/me')[0]!.body).toEqual({ confirm: true });
    await waitFor(() => expect(world.services.auth.getState().status).toBe('signedOut'));
    expect(world.nav.last()).toEqual({ type: 'tab', route: { name: 'home' } });
    expect(await world.tokenStore.get(TOKENS_KEY)).toBeNull();
  });

  it('keeps the account and says why when deleting fails', async () => {
    const { world, view } = await open();
    world.http.failNext('DELETE /v1/me', 'internal_error');
    fireEvent.click(view.getByTestId('profile-delete'));
    fireEvent.click(await view.findByTestId('delete-sheet-confirm'));
    expect(await view.findByText(en['errors.internal_error'], { exact: false })).toBeTruthy();
    expect(world.services.auth.getState().status).toBe('signedIn');
  });

  it('opens help and about, and shows the app version', async () => {
    const { world, view } = await open();
    fireEvent.click(view.getByTestId('profile-help'));
    expect(world.nav.last()).toEqual({ type: 'go', route: { name: 'page', slug: 'faq' } });
    fireEvent.click(view.getByTestId('profile-about'));
    expect(world.nav.last()).toEqual({ type: 'go', route: { name: 'page', slug: 'about' } });
    expect(view.getByTestId('profile-version').textContent).toContain(world.services.appVersion);
  });

  describe.each(MATRIX)('in $name', ({ locale, color, textSize }) => {
    it('draws the profile', async () => {
      const world = await createWorld({
        signedIn: true,
        mock: mine(),
        locale,
        color,
        textSize,
      });
      const view = await renderScreen(<ProfileScreen />, { world });
      await view.findByTestId('profile-account');
      await view.findByTestId(`alerts-${FOLLOW.id}`);
      expect(directionOf(view.container)).toBe(locale === 'ur' ? 'rtl' : 'ltr');
      expectGreenHeader(view.container, color);
      const words = locale === 'ur' ? ur : en;
      expect(view.getByText(words['profile.language.title'])).toBeTruthy();
      expect(view.getByText(words['profile.account.delete'])).toBeTruthy();
    });
  });
});
