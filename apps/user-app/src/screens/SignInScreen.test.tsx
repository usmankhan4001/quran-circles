import { fireEvent, within } from '@testing-library/react';
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
  it('walks through phone, code and returns to where the person came from', async () => {
    const world = await openWorld();
    const view = await renderScreen(<SignInScreen returnTo="/register/abc?occurrenceId=o1" />, {
      world,
    });
    fireEvent.change(view.getByTestId('phone-input'), { target: { value: '0300 1234567' } });
    fireEvent.click(view.getByTestId('send-code'));
    const code = await view.findByTestId('code-input');
    expect(view.getByText(en['signIn.code.introWhatsapp'])).toBeTruthy();
    fireEvent.change(code, { target: { value: '123456' } });
    fireEvent.click(view.getByTestId('verify-code'));
    await waitFor(() => expect(world.nav.last()).toBeDefined());
    expect(world.nav.last()).toEqual({
      type: 'replace',
      route: { name: 'register', sessionId: 'abc', occurrenceId: 'o1' },
    });
    expect(world.services.auth.getState().status).toBe('signedIn');
  });

  it('shows a plain message for a number that cannot be right', async () => {
    const view = await renderScreen(<SignInScreen />, { world: await openWorld() });
    fireEvent.change(view.getByTestId('phone-input'), { target: { value: '12' } });
    fireEvent.click(view.getByTestId('send-code'));
    expect(await view.findByText(en['signIn.problem.phone'])).toBeTruthy();
  });

  it('says sign-in needs a Pakistani mobile number for a number from abroad, in both languages', async () => {
    for (const locale of ['en', 'ur'] as const) {
      const world = await openWorld({}, locale);
      const view = await renderScreen(<SignInScreen />, { world });
      fireEvent.change(view.getByTestId('phone-input'), { target: { value: '+447700900123' } });
      fireEvent.click(view.getByTestId('send-code'));
      const words = (locale === 'ur' ? ur : en)['issues.phone_not_pakistan_mobile'];
      expect(await view.findByText(words)).toBeTruthy();
      expect(world.http.callsTo('POST /v1/auth/code')).toHaveLength(0);
      view.unmount();
    }
  });

  it('shows the same message when the server refuses the number', async () => {
    const world = await createWorld({
      mock: {
        handlers: {
          ...signInHandlers(),
          'auth.requestCode': (_c: unknown, id: string) =>
            new Response(
              JSON.stringify(
                makeApiError('validation_failed', id, {
                  issues: [{ path: 'phone', code: 'phone_not_pakistan_mobile' }],
                }),
              ),
              { status: 400, headers: { 'content-type': 'application/json' } },
            ),
        },
      },
    });
    const view = await renderScreen(<SignInScreen />, { world });
    fireEvent.change(view.getByTestId('phone-input'), { target: { value: '0300 1234567' } });
    fireEvent.click(view.getByTestId('send-code'));
    expect(await view.findByText(en['issues.phone_not_pakistan_mobile'])).toBeTruthy();
    expect(view.getByTestId('phone-input')).toBeTruthy();
  });

  it('shows the message for a wrong code and stays on the code step', async () => {
    const world = await openWorld();
    const view = await renderScreen(<SignInScreen />, { world });
    fireEvent.change(view.getByTestId('phone-input'), { target: { value: '03001234567' } });
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
    fireEvent.change(view.getByTestId('phone-input'), { target: { value: '03001234567' } });
    fireEvent.click(view.getByTestId('send-code'));
    const text = await view.findByText(new RegExp(en['errors.rate_limited']));
    expect(text.textContent).toContain('30 seconds');
  });

  it('makes the person wait before asking for another code', async () => {
    const view = await renderScreen(<SignInScreen />, { world: await openWorld() });
    fireEvent.change(view.getByTestId('phone-input'), { target: { value: '03001234567' } });
    fireEvent.click(view.getByTestId('send-code'));
    await view.findByTestId('code-input');
    expect(view.getByTestId('resend-code').textContent).toContain('30');
    expect(view.queryByTestId('resend-sms')).toBeNull();
  });

  it('offers SMS when the WhatsApp code does not arrive, and a different number', async () => {
    const world = await openWorld();
    const view = await renderScreen(<SignInScreen />, { world });
    fireEvent.change(view.getByTestId('phone-input'), { target: { value: '03001234567' } });
    fireEvent.click(view.getByTestId('send-code'));
    const code = await view.findByTestId('code-input');
    world.clock.advance(31_000);
    fireEvent.change(code, { target: { value: '1' } });
    fireEvent.click(await view.findByTestId('resend-sms'));
    await waitFor(() => expect(view.getByText(en['signIn.code.introSms'])).toBeTruthy());
    fireEvent.click(view.getByTestId('change-number'));
    expect(await view.findByTestId('phone-input')).toBeTruthy();
  });

  it('asks a new person for a name and lets them skip it', async () => {
    const world = await openWorld({ isNewAccount: true, displayName: null });
    const view = await renderScreen(<SignInScreen />, { world });
    fireEvent.change(view.getByTestId('phone-input'), { target: { value: '03001234567' } });
    fireEvent.click(view.getByTestId('send-code'));
    fireEvent.change(await view.findByTestId('code-input'), { target: { value: '123456' } });
    fireEvent.click(view.getByTestId('verify-code'));
    expect(await view.findByTestId('name-input')).toBeTruthy();
    expect(world.nav.calls).toHaveLength(0);
    fireEvent.click(view.getByTestId('skip-name'));
    expect(world.nav.last()).toEqual({ type: 'replace', route: { name: 'home' } });
  });

  it('says the code goes on WhatsApp, with SMS as the fallback', () => {
    expect(en['signIn.phone.intro']).toMatch(/WhatsApp/);
    expect(en['signIn.phone.intro']).toMatch(/SMS/);
    expect(ur['signIn.phone.intro']).toMatch(/واٹس ایپ/);
    expect(ur['signIn.phone.intro']).toMatch(/ایس ایم ایس/);
  });

  it('keeps the phone number left to right inside an Urdu screen', async () => {
    const view = await renderScreen(<SignInScreen />, { world: await openWorld({}, 'ur') });
    expect(view.getByTestId('phone-input').getAttribute('dir')).toBe('ltr');
    expect(view.getByText(ur['signIn.phone.intro'])).toBeTruthy();
  });

  describe.each(MATRIX)('in $name', ({ locale, color, textSize }) => {
    it('draws the first step', async () => {
      const view = await renderScreen(<SignInScreen />, { locale, color, textSize });
      expect(directionOf(view.container)).toBe(locale === 'ur' ? 'rtl' : 'ltr');
      const words = locale === 'ur' ? ur : en;
      // A plain white top with back and the title in the middle, then a big heading (D17).
      expect(
        within(view.getByTestId('screen-header')).getByText(words['signIn.title']),
      ).toBeTruthy();
      expect(view.getByText(words['signIn.heading'])).toBeTruthy();
      expect(view.getByText(words['signIn.phone.intro'])).toBeTruthy();
      expect(view.getByTestId('send-code')).toBeTruthy();
    });
  });
});
