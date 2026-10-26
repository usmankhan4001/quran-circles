import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { messages } from '@qc/i18n';
import { AuthGate } from '../../shell/AuthGate';
import { AppProviders } from '../../shell/AppProviders';
import { createMemoryStore } from '../../storage/storage';
import { createBackend, meFor, type Backend } from '../../test/backend';
import { BASE_URL, passWelcome } from '../../test/render';

/** The sign-in screen as the app shows it to someone with nothing saved. */
async function mountSignIn(backend: Backend, locale: 'en' | 'ur' = 'en') {
  const prefsStore = createMemoryStore({});
  const view = render(
    <AppProviders
      baseUrl={BASE_URL}
      tokenStore={createMemoryStore({})}
      prefsStore={prefsStore}
      fetch={backend.fetch}
      initialAppearance={{ locale, colorChoice: 'light', textSize: 0 }}
    >
      <AuthGate prefsStore={prefsStore}>
        <div data-testid="the-app" />
      </AuthGate>
    </AppProviders>,
  );
  await screen.findByTestId('sign-in');
  await passWelcome();
  return view;
}

function typeEmail(value: string) {
  const el = screen.getByTestId('sign-in-email');
  const input = el.tagName === 'INPUT' ? el : (el.querySelector('input') ?? el);
  fireEvent.change(input, { target: { value } });
  fireEvent.click(screen.getByTestId('sign-in-send-code'));
}

function typePhone(value: string) {
  const el = screen.getByTestId('sign-in-phone');
  const input = el.tagName === 'INPUT' ? el : (el.querySelector('input') ?? el);
  fireEvent.change(input, { target: { value } });
}

describe('SignInScreen: email and the first-time WhatsApp number', () => {
  it.each(['en', 'ur'] as const)(
    'says so for an email that cannot be right, without asking the server (%s)',
    async (locale) => {
      const backend = createBackend({ me: meFor('venue') });
      const view = await mountSignIn(backend, locale);
      typeEmail('coordinator@');
      expect(await screen.findByText(messages[locale]['admin.signIn.emailInvalid'])).toBeTruthy();
      expect(backend.callsTo('auth.requestCode')).toHaveLength(0);
      expect(screen.queryByTestId('sign-in-code')).toBeNull();
      view.unmount();
    },
  );

  it('still calls a malformed WhatsApp number malformed, without asking the server', async () => {
    const backend = createBackend({ me: meFor('venue') });
    await mountSignIn(backend);
    typePhone('12');
    typeEmail('coordinator@example.com');
    expect(await screen.findByText(messages.en['admin.signIn.phoneInvalid'])).toBeTruthy();
    expect(backend.callsTo('auth.requestCode')).toHaveLength(0);
  });

  it('accepts a WhatsApp number from abroad', async () => {
    const backend = createBackend({ me: meFor('venue') });
    await mountSignIn(backend);
    typePhone('+44 7700 900123');
    typeEmail('coordinator@example.com');
    await screen.findByTestId('sign-in-code');
    expect(backend.callsTo('auth.requestCode')[0]!.body).toMatchObject({ phone: '+447700900123' });
  });

  it.each([
    ['en', 847, 'Please wait about 15 minutes.'],
    ['en', 60, 'Please wait 1 minute.'],
    ['en', 30, 'Please wait 30 seconds.'],
    ['en', 7200, 'Please wait 2 hours.'],
    ['ur', 847, messages.ur['admin.signIn.wait.aboutMinutes.other']],
  ] as const)(
    'says how long to wait in words, not raw seconds (%s, %j s)',
    async (locale, seconds, expected) => {
      const backend = createBackend({ me: meFor('venue') });
      backend.failWith('auth.requestCode', 'rate_limited', { retryAfterSeconds: seconds });
      const view = await mountSignIn(backend, locale);
      typeEmail('coordinator@example.com');
      const notice = (await screen.findByTestId('sign-in-notice')).textContent ?? '';
      expect(notice).toContain(messages[locale]['errors.rate_limited']);
      if (locale === 'en') expect(notice).toContain(expected);
      // Urdu: the template's words around the count, with the count filled in.
      else for (const part of expected.split('{count}')) expect(notice).toContain(part);
      if (seconds >= 60) expect(notice).not.toContain(String(seconds));
      view.unmount();
    },
  );

  it('shows the refusal alone when the server gives no wait', async () => {
    const backend = createBackend({ me: meFor('venue') });
    backend.failWith('auth.requestCode', 'rate_limited', { retryAfterSeconds: null });
    await mountSignIn(backend);
    typeEmail('coordinator@example.com');
    const notice = await screen.findByTestId('sign-in-notice');
    expect(notice.textContent).toBe(messages.en['errors.rate_limited']);
  });

  it('keeps any other validation failure as a notice', async () => {
    const backend = createBackend({ me: meFor('venue') });
    backend.failWith('auth.requestCode', 'validation_failed', {
      issues: [{ path: 'locale', code: 'invalid_value' }],
    });
    await mountSignIn(backend);
    typeEmail('coordinator@example.com');
    const notice = await screen.findByTestId('sign-in-notice');
    expect(notice.textContent).toContain(messages.en['errors.validation_failed']);
  });
});

describe('SignInScreen: welcome first', () => {
  const mountBare = async (locale: 'en' | 'ur') => {
    const prefsStore = createMemoryStore({});
    render(
      <AppProviders
        baseUrl={BASE_URL}
        tokenStore={createMemoryStore({})}
        prefsStore={prefsStore}
        fetch={createBackend({ me: meFor('venue') }).fetch}
        initialAppearance={{ locale, colorChoice: 'light', textSize: 0 }}
      >
        <AuthGate prefsStore={prefsStore}>
          <div />
        </AuthGate>
      </AppProviders>,
    );
    await screen.findByTestId('welcome');
  };

  it.each(['en', 'ur'] as const)('opens on the invitation-only welcome (%s)', async (locale) => {
    await mountBare(locale);
    expect(screen.queryByTestId('sign-in-email')).toBeNull();
    expect(screen.getByText(messages[locale]['admin.signIn.welcome.tag'])).toBeTruthy();
    expect(screen.getByText(messages[locale]['admin.signIn.inviteOnly'])).toBeTruthy();
    await passWelcome();
  });

  it('shows what the app does from "What can I do here?" and signs in from there', async () => {
    await mountBare('en');
    fireEvent.click(screen.getByTestId('welcome-features'));
    expect(await screen.findByTestId('features')).toBeTruthy();
    expect(screen.getByText(messages.en['admin.signIn.features.2.title'])).toBeTruthy();
    fireEvent.click(screen.getByTestId('features-sign-in'));
    expect(await screen.findByTestId('sign-in-email')).toBeTruthy();
  });
});
