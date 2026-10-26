import { ERROR_CODES, makeApiError } from '@qc/contracts';
import { describe, expect, it } from 'vitest';
import { emailField, renderConsole, screen, text } from '../test/harness';
import type { Locale } from '../i18n';

const codeRequests = (calls: { path: string }[]) => calls.filter((c) => c.path === '/v1/auth/code');

async function askForCode(
  user: ReturnType<typeof renderConsole>['user'],
  address: string,
  options: { phone?: string; locale?: Locale } = {},
) {
  const locale = options.locale ?? 'en';
  await user.type(await emailField(user, locale), address);
  if (options.phone) {
    await user.type(
      screen.getByLabelText(text('console.signIn.phone.label', locale)),
      options.phone,
    );
  }
  await user.click(screen.getByRole('button', { name: text('console.signIn.sendCode', locale) }));
}

const refusal = (path: string, code: string) => (_c: unknown, id: string) =>
  new Response(
    JSON.stringify(makeApiError('validation_failed', id, { issues: [{ path, code }] })),
    { status: ERROR_CODES.validation_failed, headers: { 'content-type': 'application/json' } },
  );

describe('sign in: email, and the WhatsApp number for a first sign-in', () => {
  it.each<Locale>(['en', 'ur'])(
    'rejects an email that cannot be right, without a request (%s)',
    async (locale) => {
      const { user, calls } = renderConsole({ signedIn: false, locale });
      await askForCode(user, 'coordinator@', { locale });
      expect(await screen.findByText(text('console.signIn.email.invalid', locale))).toBeTruthy();
      expect(codeRequests(calls)).toEqual([]);
    },
  );

  it('sends the code request by email, with no number when none was typed', async () => {
    const { user, calls } = renderConsole({ signedIn: false });
    await askForCode(user, ' Coordinator@Example.com ');
    await screen.findByLabelText(new RegExp(text('console.signIn.code.label')));
    const body = codeRequests(calls)[0] as unknown as { body: Record<string, unknown> };
    expect(body.body).toMatchObject({ email: 'coordinator@example.com', channel: 'email' });
    expect(body.body).not.toHaveProperty('phone');
  });

  it('sends a WhatsApp number from any country with the request when one is typed', async () => {
    const { user, calls } = renderConsole({ signedIn: false });
    await askForCode(user, 'coordinator@example.com', { phone: '+44 7700 900123' });
    await screen.findByLabelText(new RegExp(text('console.signIn.code.label')));
    expect((codeRequests(calls)[0] as unknown as { body: unknown }).body).toMatchObject({
      phone: '+447700900123',
    });
  });

  it('still calls a malformed number malformed, without a request', async () => {
    const { user, calls } = renderConsole({ signedIn: false });
    await askForCode(user, 'coordinator@example.com', { phone: '12345' });
    expect(await screen.findByText(text('console.phone.error.invalid'))).toBeTruthy();
    expect(codeRequests(calls)).toEqual([]);
  });

  it('asks for the number when the server says this is a first sign-in', async () => {
    const { user } = renderConsole({
      signedIn: false,
      handlers: { 'auth.verifyCode': refusal('phone', 'phone_required') },
    });
    await askForCode(user, 'coordinator@example.com');
    const code = await screen.findByLabelText(new RegExp(text('console.signIn.code.label')));
    await user.type(code, '123456');
    await user.click(screen.getByRole('button', { name: text('console.signIn.verify') }));
    expect(await screen.findByText(text('console.signIn.phone.needed'))).toBeTruthy();
    expect(screen.getByLabelText(new RegExp(text('console.signIn.email.label')))).toBeTruthy();
  });

  it('keeps any other refusal as the general message', async () => {
    const { user } = renderConsole({
      signedIn: false,
      forceError: (c) => (c.path === '/v1/auth/code' ? 'validation_failed' : undefined),
    });
    await askForCode(user, 'coordinator@example.com');
    expect(await screen.findByText(text('errors.validation_failed'))).toBeTruthy();
  });
});
