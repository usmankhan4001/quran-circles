import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { messages } from '@qc/i18n';
import { AuthGate } from '../../shell/AuthGate';
import { AppProviders } from '../../shell/AppProviders';
import { createMemoryStore } from '../../storage/storage';
import { createBackend, meFor, type Backend } from '../../test/backend';
import { BASE_URL } from '../../test/render';

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
  return view;
}

function typePhone(value: string) {
  const el = screen.getByTestId('sign-in-phone');
  const input = el.tagName === 'INPUT' ? el : (el.querySelector('input') ?? el);
  fireEvent.change(input, { target: { value } });
  fireEvent.click(screen.getByTestId('sign-in-send-code'));
}

describe('SignInScreen: only Pakistani mobile numbers', () => {
  it.each(['en', 'ur'] as const)(
    'says so for a number from abroad, without asking the server (%s)',
    async (locale) => {
      const backend = createBackend({ me: meFor('venue') });
      const view = await mountSignIn(backend, locale);
      typePhone('+44 7700 900123');
      expect(
        await screen.findByText(messages[locale]['issues.phone_not_pakistan_mobile']),
      ).toBeTruthy();
      expect(backend.callsTo('auth.requestCode')).toHaveLength(0);
      expect(screen.queryByTestId('sign-in-code')).toBeNull();
      view.unmount();
    },
  );

  it('says so for a Pakistani landline, which cannot get a WhatsApp code', async () => {
    const backend = createBackend({ me: meFor('venue') });
    await mountSignIn(backend);
    typePhone('+92 51 1234567');
    expect(await screen.findByText(messages.en['issues.phone_not_pakistan_mobile'])).toBeTruthy();
    expect(backend.callsTo('auth.requestCode')).toHaveLength(0);
  });

  it('still calls a malformed number malformed', async () => {
    const backend = createBackend({ me: meFor('venue') });
    await mountSignIn(backend);
    typePhone('12');
    expect(await screen.findByText(messages.en['admin.signIn.phoneInvalid'])).toBeTruthy();
    expect(screen.queryByText(messages.en['issues.phone_not_pakistan_mobile'])).toBeNull();
  });

  it('shows the message under the number when the server refuses it', async () => {
    const backend = createBackend({ me: meFor('venue') });
    backend.failWith('auth.requestCode', 'validation_failed', {
      issues: [{ path: 'phone', code: 'phone_not_pakistan_mobile' }],
    });
    await mountSignIn(backend);
    typePhone('0300 1234567');
    expect(await screen.findByText(messages.en['issues.phone_not_pakistan_mobile'])).toBeTruthy();
    expect(backend.callsTo('auth.requestCode')).toHaveLength(1);
    expect(screen.queryByTestId('sign-in-notice')).toBeNull();
    expect(screen.getByTestId('sign-in-phone')).toBeTruthy();
  });

  it('keeps any other validation failure as a notice', async () => {
    const backend = createBackend({ me: meFor('venue') });
    backend.failWith('auth.requestCode', 'validation_failed', {
      issues: [{ path: 'locale', code: 'invalid_value' }],
    });
    await mountSignIn(backend);
    typePhone('0300 1234567');
    const notice = await screen.findByTestId('sign-in-notice');
    expect(notice.textContent).toContain(messages.en['errors.validation_failed']);
    expect(screen.queryByText(messages.en['issues.phone_not_pakistan_mobile'])).toBeNull();
  });
});
