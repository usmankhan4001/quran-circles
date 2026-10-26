import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import * as fx from '@qc/contracts/fixtures';
import { messages } from '@qc/i18n';
import { TOKENS_KEY } from '../auth/AuthProvider';
import { createMemoryStore } from '../storage/storage';
import { WORKING_SCOPE_KEY, useWorkingScope } from '../scope/WorkingScopeProvider';
import { createBackend, meFor, STAFF_TOKEN, type Backend } from '../test/backend';
import { BASE_URL, tokens, passWelcome } from '../test/render';
import { AppProviders } from './AppProviders';
import { AuthGate } from './AuthGate';

function ScopeProbe() {
  const { active } = useWorkingScope();
  return <div data-testid="the-app">{active?.id ?? 'none'}</div>;
}

function mountApp(
  backend: Backend,
  opts: { signedIn?: boolean; locale?: 'en' | 'ur'; saved?: string } = {},
) {
  const tokenStore = createMemoryStore(
    opts.signedIn ? { [TOKENS_KEY]: JSON.stringify(tokens) } : {},
  );
  const prefsStore = createMemoryStore(opts.saved ? { [WORKING_SCOPE_KEY]: opts.saved } : {});
  render(
    <AppProviders
      baseUrl={BASE_URL}
      tokenStore={tokenStore}
      prefsStore={prefsStore}
      fetch={backend.fetch}
      initialAppearance={{ locale: opts.locale ?? 'en', colorChoice: 'light', textSize: 0 }}
    >
      <AuthGate prefsStore={prefsStore}>
        <ScopeProbe />
      </AuthGate>
    </AppProviders>,
  );
  return { tokenStore, prefsStore };
}

const type = (testId: string, value: string) => {
  const el = screen.getByTestId(testId);
  const input = el.tagName === 'INPUT' ? el : (el.querySelector('input') ?? el);
  fireEvent.change(input, { target: { value } });
};

describe('AuthGate and phone-code sign-in', () => {
  it('shows the sign-in screen when nothing is saved', async () => {
    mountApp(createBackend({ me: meFor('venue') }));
    expect(await screen.findByTestId('sign-in')).toBeTruthy();
    expect(screen.queryByTestId('the-app')).toBeNull();
  });

  it('restores a saved sign-in and opens the app without asking again', async () => {
    const backend = createBackend({ me: meFor('city') });
    mountApp(backend, { signedIn: true });
    expect(await screen.findByTestId('the-app')).toBeTruthy();
    expect(backend.callsTo('me.get')).toHaveLength(1);
  });

  it('forgets a saved sign-in the server no longer accepts', async () => {
    const backend = createBackend({ me: meFor('city') });
    backend.failWith('me.get', 'unauthenticated', { times: 3 });
    const { tokenStore } = mountApp(backend, { signedIn: true });
    expect(await screen.findByTestId('sign-in')).toBeTruthy();
    expect(await tokenStore.get(TOKENS_KEY)).toBeNull();
  });

  it('signs a coordinator in with an email code and opens the app', async () => {
    const backend = createBackend({ me: meFor('venue') });
    const { tokenStore } = mountApp(backend);
    await screen.findByTestId('sign-in');
    await passWelcome();
    type('sign-in-email', 'coordinator@example.com');
    fireEvent.click(screen.getByTestId('sign-in-send-code'));
    await screen.findByTestId('sign-in-code');
    expect(backend.callsTo('auth.requestCode')[0]!.body).toMatchObject({
      email: 'coordinator@example.com',
      channel: 'email',
    });
    type('sign-in-code', '123456');
    fireEvent.click(screen.getByTestId('sign-in-verify'));
    expect(await screen.findByTestId('the-app')).toBeTruthy();
    expect(JSON.parse((await tokenStore.get(TOKENS_KEY)) ?? '{}')).toMatchObject({
      accessToken: STAFF_TOKEN,
    });
  });

  it('rejects a malformed email before asking the server', async () => {
    const backend = createBackend({ me: meFor('venue') });
    mountApp(backend);
    await screen.findByTestId('sign-in');
    await passWelcome();
    type('sign-in-email', 'coordinator@');
    fireEvent.click(screen.getByTestId('sign-in-send-code'));
    expect(await screen.findByText(messages.en['admin.signIn.emailInvalid'])).toBeTruthy();
    expect(backend.callsTo('auth.requestCode')).toHaveLength(0);
  });

  it('rejects a short code before asking the server', async () => {
    const backend = createBackend({ me: meFor('venue') });
    mountApp(backend);
    await screen.findByTestId('sign-in');
    await passWelcome();
    type('sign-in-email', 'coordinator@example.com');
    fireEvent.click(screen.getByTestId('sign-in-send-code'));
    await screen.findByTestId('sign-in-code');
    type('sign-in-code', '123');
    fireEvent.click(screen.getByTestId('sign-in-verify'));
    expect(await screen.findByText('Enter the 6-digit code.')).toBeTruthy();
    expect(backend.callsTo('auth.verifyCode')).toHaveLength(0);
  });

  it('maps a wrong code to its error message', async () => {
    const backend = createBackend({ me: meFor('venue') });
    mountApp(backend);
    await screen.findByTestId('sign-in');
    await passWelcome();
    type('sign-in-email', 'coordinator@example.com');
    fireEvent.click(screen.getByTestId('sign-in-send-code'));
    await screen.findByTestId('sign-in-code');
    type('sign-in-code', '000000');
    fireEvent.click(screen.getByTestId('sign-in-verify'));
    expect(await screen.findByText(/That code is not right/)).toBeTruthy();
    expect(screen.queryByTestId('the-app')).toBeNull();
  });

  it('tells the person to wait when asking for codes too often', async () => {
    const backend = createBackend({ me: meFor('venue') });
    backend.failWith('auth.requestCode', 'rate_limited');
    mountApp(backend);
    await screen.findByTestId('sign-in');
    await passWelcome();
    type('sign-in-email', 'coordinator@example.com');
    fireEvent.click(screen.getByTestId('sign-in-send-code'));
    const notice = await screen.findByTestId('sign-in-notice');
    expect(notice.textContent).toMatch(/Too many tries/);
    expect(notice.textContent).toMatch(/30 seconds/);
  });

  it('says so when offline instead of failing silently', async () => {
    const backend = createBackend({ me: meFor('venue') });
    mountApp(backend);
    await screen.findByTestId('sign-in');
    await passWelcome();
    backend.setOffline(true);
    type('sign-in-email', 'coordinator@example.com');
    fireEvent.click(screen.getByTestId('sign-in-send-code'));
    expect(await screen.findByTestId('sign-in-notice')).toBeTruthy();
  });

  it('lets the person go back and use another email', async () => {
    mountApp(createBackend({ me: meFor('venue') }));
    await screen.findByTestId('sign-in');
    await passWelcome();
    type('sign-in-email', 'coordinator@example.com');
    fireEvent.click(screen.getByTestId('sign-in-send-code'));
    await screen.findByTestId('sign-in-code');
    fireEvent.click(screen.getByTestId('sign-in-change-email'));
    expect(await screen.findByTestId('sign-in-email')).toBeTruthy();
  });

  it('gives a verified email with no staff role no access to anything', async () => {
    const backend = createBackend({ me: { ...fx.fixtureMe, roles: [] } });
    mountApp(backend);
    await screen.findByTestId('sign-in');
    await passWelcome();
    type('sign-in-email', 'coordinator@example.com');
    fireEvent.click(screen.getByTestId('sign-in-send-code'));
    await screen.findByTestId('sign-in-code');
    type('sign-in-code', '123456');
    fireEvent.click(screen.getByTestId('sign-in-verify'));
    expect(await screen.findByTestId('not-invited')).toBeTruthy();
    expect(screen.queryByTestId('the-app')).toBeNull();
    // Nothing of the admin API is touched for such a person.
    expect(backend.calls.filter((c) => c.path.startsWith('/v1/admin'))).toHaveLength(0);
  });

  it('signs out, forgets the tokens and returns to sign-in', async () => {
    const backend = createBackend({ me: { ...fx.fixtureMe, roles: [] } });
    const { tokenStore } = mountApp(backend, { signedIn: true });
    fireEvent.click(await screen.findByTestId('not-invited-sign-out'));
    expect(await screen.findByTestId('sign-in')).toBeTruthy();
    await waitFor(async () => expect(await tokenStore.get(TOKENS_KEY)).toBeNull());
  });

  it('opens the app in the saved working scope', async () => {
    const backend = createBackend({ me: meFor('multi') });
    const second = backend.me.roles[1]!.id;
    const { prefsStore } = mountApp(backend, { signedIn: true, saved: second });
    expect((await screen.findByTestId('the-app')).textContent).toBe(second);
    expect(await prefsStore.get(WORKING_SCOPE_KEY)).toBe(second);
  });

  it('says the code goes by email, and asks for the WhatsApp number only for a first sign-in', async () => {
    const backend = createBackend({ me: meFor('venue') });
    mountApp(backend);
    await screen.findByTestId('sign-in');
    await passWelcome();
    const helper = messages.en['admin.signIn.emailHelper'];
    expect(helper).toMatch(/code/);
    expect(screen.getByText(helper)).toBeTruthy();
    type('sign-in-email', 'coordinator@example.com');
    fireEvent.click(screen.getByTestId('sign-in-send-code'));
    await screen.findByTestId('sign-in-code');
    const body = backend.callsTo('auth.requestCode')[0]!.body as Record<string, unknown>;
    expect(body).toMatchObject({ channel: 'email' });
    expect(body).not.toHaveProperty('phone');
  });

  it('sends the WhatsApp number with the code request when it is filled in', async () => {
    const backend = createBackend({ me: meFor('venue') });
    mountApp(backend);
    await screen.findByTestId('sign-in');
    await passWelcome();
    type('sign-in-email', 'coordinator@example.com');
    type('sign-in-phone', '0300 1234567');
    fireEvent.click(screen.getByTestId('sign-in-send-code'));
    await screen.findByTestId('sign-in-code');
    expect(backend.callsTo('auth.requestCode')[0]!.body).toMatchObject({
      email: 'coordinator@example.com',
      phone: '+923001234567',
    });
  });

  it('asks for the WhatsApp number when the server says this is a first sign-in', async () => {
    const backend = createBackend({ me: meFor('venue') });
    backend.failWith('auth.verifyCode', 'validation_failed', {
      issues: [{ path: 'phone', code: 'phone_required' }],
    });
    mountApp(backend);
    await screen.findByTestId('sign-in');
    await passWelcome();
    type('sign-in-email', 'coordinator@example.com');
    fireEvent.click(screen.getByTestId('sign-in-send-code'));
    await screen.findByTestId('sign-in-code');
    type('sign-in-code', '123456');
    fireEvent.click(screen.getByTestId('sign-in-verify'));
    expect(await screen.findByText(messages.en['admin.signIn.firstTimeNeeded'])).toBeTruthy();
    expect(screen.getByTestId('sign-in-email')).toBeTruthy();
  });

  it('shows the sign-in screen in Urdu, right to left', async () => {
    mountApp(createBackend({ me: meFor('venue') }), { locale: 'ur' });
    await passWelcome();
    const root = screen.getByTestId('sign-in');
    expect(root.closest('[dir]')?.getAttribute('dir')).toBe('rtl');
    expect(screen.getByTestId('sign-in-send-code').textContent).toBe('کوڈ بھیجیں');
    expect(screen.getByText(messages.ur['admin.signIn.emailHelper'])).toBeTruthy();
    expect(messages.ur['admin.signIn.emailHelper']).toMatch(/ای میل/);
  });
});
