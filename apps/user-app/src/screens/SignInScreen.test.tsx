import { fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { makeApiError } from '@qc/contracts';
import { messages } from '@qc/i18n';
import {
  MATRIX,
  createWorld,
  directionOf,
  renderScreen,
  signInHandlers,
  waitFor,
} from '../test/harness';
import { SignInScreen, routeAfterSignIn } from './SignInScreen';

const en = messages.en;
const ur = messages.ur;

async function openWorld(
  options: Parameters<typeof signInHandlers>[0] = {},
  locale: 'en' | 'ur' = 'en',
) {
  return createWorld({ locale, mock: { handlers: signInHandlers(options) } });
}

describe('routeAfterSignIn', () => {
  it('goes back to where the person was, or Home', () => {
    expect(routeAfterSignIn('/session/abc')).toEqual({ name: 'session', sessionId: 'abc' });
    expect(routeAfterSignIn(undefined)).toEqual({ name: 'home' });
    expect(routeAfterSignIn('/nonsense/x')).toEqual({ name: 'home' });
  });
});

describe('SignInScreen', () => {
  it('walks through email, code and returns to where the person came from', async () => {
    const world = await openWorld();
    const view = await renderScreen(<SignInScreen returnTo="/register/abc?occurrenceId=o1" />, {
      world,
    });
    fireEvent.change(view.getByTestId('email-input'), { target: { value: 'aisha@example.com' } });
    fireEvent.click(view.getByTestId('send-code'));
    const code = await view.findByTestId('code-input');
    expect(view.getByText(/6-digit code to aisha@example.com/)).toBeTruthy();
    fireEvent.change(code, { target: { value: '123456' } });
    fireEvent.click(view.getByTestId('verify-code'));
    await waitFor(() => expect(world.nav.last()).toBeDefined());
    expect(world.nav.last()).toEqual({
      type: 'replace',
      route: { name: 'register', sessionId: 'abc', occurrenceId: 'o1' },
    });
    expect(world.services.auth.getState().status).toBe('signedIn');
  });

  it('shows a plain message for an email that cannot be right', async () => {
    const view = await renderScreen(<SignInScreen />, { world: await openWorld() });
    fireEvent.change(view.getByTestId('email-input'), { target: { value: 'aisha@' } });
    fireEvent.click(view.getByTestId('send-code'));
    expect(await view.findByText(en['signIn.problem.email'])).toBeTruthy();
  });

  it('points a person with no account to sign up, in both languages', async () => {
    for (const locale of ['en', 'ur'] as const) {
      const world = await createWorld({
        locale,
        mock: {
          handlers: {
            ...signInHandlers(),
            'auth.verifyCode': (_c: unknown, id: string) =>
              new Response(
                JSON.stringify(
                  makeApiError('validation_failed', id, {
                    issues: [{ path: 'phone', code: 'phone_required' }],
                  }),
                ),
                { status: 400, headers: { 'content-type': 'application/json' } },
              ),
          },
        },
      });
      const view = await renderScreen(<SignInScreen />, { world });
      fireEvent.change(view.getByTestId('email-input'), { target: { value: 'new@example.com' } });
      fireEvent.click(view.getByTestId('send-code'));
      fireEvent.change(await view.findByTestId('code-input'), { target: { value: '123456' } });
      fireEvent.click(view.getByTestId('verify-code'));
      const words = (locale === 'ur' ? ur : en)['signIn.problem.noAccount'];
      expect(await view.findByText(words)).toBeTruthy();
      expect(view.getByTestId('sign-in-new-here')).toBeTruthy();
      view.unmount();
    }
  });

  it('shows the message for a wrong code and stays on the code step', async () => {
    const world = await openWorld();
    const view = await renderScreen(<SignInScreen />, { world });
    fireEvent.change(view.getByTestId('email-input'), { target: { value: 'aisha@example.com' } });
    fireEvent.click(view.getByTestId('send-code'));
    fireEvent.change(await view.findByTestId('code-input'), { target: { value: '654321' } });
    fireEvent.click(view.getByTestId('verify-code'));
    expect(await view.findByText(en['errors.otp_invalid'])).toBeTruthy();
    expect(view.getByTestId('code-input')).toBeTruthy();
  });

  it('shows how long to wait after too many tries', async () => {
    const world = await openWorld();
    world.http.failNext('POST /v1/auth/code', 'rate_limited');
    const view = await renderScreen(<SignInScreen />, { world });
    fireEvent.change(view.getByTestId('email-input'), { target: { value: 'aisha@example.com' } });
    fireEvent.click(view.getByTestId('send-code'));
    const text = await view.findByText(new RegExp(en['errors.rate_limited']));
    expect(text.textContent).toContain('30 seconds');
  });

  /** A world whose server refuses a code with this wait (null: no wait at all). */
  async function refusedWorld(retryAfterSeconds: number | null, locale: 'en' | 'ur' = 'en') {
    return createWorld({
      locale,
      mock: {
        handlers: {
          ...signInHandlers(),
          'auth.requestCode': (_c: unknown, id: string) =>
            new Response(
              JSON.stringify(
                makeApiError(
                  'rate_limited',
                  id,
                  retryAfterSeconds === null ? undefined : { retryAfterSeconds },
                ),
              ),
              { status: 429, headers: { 'content-type': 'application/json' } },
            ),
        },
      },
    });
  }

  it.each([
    [847, 'Try again in about 15 minutes.'],
    [60, 'Try again in 1 minute.'],
    [7200, 'Try again in 2 hours.'],
  ])('says a %j second wait in words, not raw seconds', async (seconds, words) => {
    const view = await renderScreen(<SignInScreen />, { world: await refusedWorld(seconds) });
    fireEvent.change(view.getByTestId('email-input'), { target: { value: 'aisha@example.com' } });
    fireEvent.click(view.getByTestId('send-code'));
    const text = await view.findByText(new RegExp(en['errors.rate_limited']));
    expect(text.textContent).toBe(`${en['errors.rate_limited']} ${words}`);
    expect(text.textContent).not.toContain(String(seconds));
  });

  it('says the wait in Urdu on an Urdu screen', async () => {
    const view = await renderScreen(<SignInScreen />, { world: await refusedWorld(847, 'ur') });
    fireEvent.change(view.getByTestId('email-input'), { target: { value: 'aisha@example.com' } });
    fireEvent.click(view.getByTestId('send-code'));
    const text = await view.findByText(new RegExp(ur['errors.rate_limited']));
    const [before, after] = ur['signIn.wait.aboutMinutes.other'].split('{count}');
    expect(text.textContent).toContain(before!);
    expect(text.textContent).toContain(after!);
    expect(text.textContent).not.toContain('847');
  });

  it('shows the refusal alone when the server gives no wait', async () => {
    const view = await renderScreen(<SignInScreen />, { world: await refusedWorld(null) });
    fireEvent.change(view.getByTestId('email-input'), { target: { value: 'aisha@example.com' } });
    fireEvent.click(view.getByTestId('send-code'));
    const text = await view.findByText(new RegExp(en['errors.rate_limited']));
    expect(text.textContent).toBe(en['errors.rate_limited']);
  });

  it('makes the person wait before asking for another code', async () => {
    const view = await renderScreen(<SignInScreen />, { world: await openWorld() });
    fireEvent.change(view.getByTestId('email-input'), { target: { value: 'aisha@example.com' } });
    fireEvent.click(view.getByTestId('send-code'));
    await view.findByTestId('code-input');
    expect(view.getByText(/Send again in 30 seconds/)).toBeTruthy();
    expect(view.queryByTestId('resend-code')).toBeNull();
    expect(view.queryByTestId('resend-sms')).toBeNull();
  });

  it('offers another code and a different email, and no SMS', async () => {
    const world = await openWorld();
    const view = await renderScreen(<SignInScreen />, { world });
    fireEvent.change(view.getByTestId('email-input'), { target: { value: 'aisha@example.com' } });
    fireEvent.click(view.getByTestId('send-code'));
    const code = await view.findByTestId('code-input');
    world.clock.advance(31_000);
    fireEvent.change(code, { target: { value: '1' } });
    fireEvent.click(await view.findByTestId('resend-code'));
    await waitFor(() => expect(world.http.callsTo('POST /v1/auth/code')).toHaveLength(2));
    expect(view.queryByTestId('resend-sms')).toBeNull();
    fireEvent.click(view.getByTestId('change-email'));
    expect(await view.findByTestId('email-input')).toBeTruthy();
  });

  it('asks a new person for a name and lets them skip it', async () => {
    const world = await openWorld({ isNewAccount: true, displayName: null });
    const view = await renderScreen(<SignInScreen />, { world });
    fireEvent.change(view.getByTestId('email-input'), { target: { value: 'aisha@example.com' } });
    fireEvent.click(view.getByTestId('send-code'));
    fireEvent.change(await view.findByTestId('code-input'), { target: { value: '123456' } });
    fireEvent.click(view.getByTestId('verify-code'));
    expect(await view.findByTestId('name-input')).toBeTruthy();
    expect(world.nav.calls).toHaveLength(0);
    fireEvent.click(view.getByTestId('skip-name'));
    expect(world.nav.last()).toEqual({ type: 'replace', route: { name: 'home' } });
  });

  it('says the code goes by email, in both languages', () => {
    expect(en['signIn.intro']).toMatch(/email/i);
    expect(ur['signIn.intro']).toMatch(/ای میل/);
    expect(en['signIn.intro']).not.toMatch(/WhatsApp|SMS/);
  });

  it('keeps the email address left to right inside an Urdu screen', async () => {
    const view = await renderScreen(<SignInScreen />, { world: await openWorld({}, 'ur') });
    expect(view.getByTestId('email-input').getAttribute('dir')).toBe('ltr');
    expect(view.getByText(ur['signIn.intro'])).toBeTruthy();
  });

  describe.each(MATRIX)('in $name', ({ locale, color, textSize }) => {
    it('draws the first step', async () => {
      const view = await renderScreen(<SignInScreen />, { locale, color, textSize });
      expect(directionOf(view.container)).toBe(locale === 'ur' ? 'rtl' : 'ltr');
      const words = locale === 'ur' ? ur : en;
      // A plain white page with a back button, then a big heading.
      expect(view.getByLabelText(words['ui.back'])).toBeTruthy();
      expect(view.getByText(words['signIn.welcomeBack'])).toBeTruthy();
      expect(view.getByText(words['signIn.intro'])).toBeTruthy();
      expect(view.getByTestId('send-code')).toBeTruthy();
    });
  });
});
