import { ERROR_CODES, makeApiError } from '@qc/contracts';
import { describe, expect, it } from 'vitest';
import { phoneField, renderConsole, screen, text } from '../test/harness';
import type { Locale } from '../i18n';

const codeRequests = (calls: { path: string }[]) => calls.filter((c) => c.path === '/v1/auth/code');

async function askForCode(
  user: ReturnType<typeof renderConsole>['user'],
  number: string,
  locale: Locale = 'en',
) {
  await user.type(await phoneField(user, locale), number);
  await user.click(screen.getByRole('button', { name: text('console.signIn.sendCode', locale) }));
}

describe('sign in: only Pakistani mobile numbers', () => {
  it.each<Locale>(['en', 'ur'])(
    'tells a number from abroad that it cannot sign in, without a request (%s)',
    async (locale) => {
      const { user, calls } = renderConsole({ signedIn: false, locale });
      await askForCode(user, '+44 7700 900123', locale);
      expect(
        await screen.findByText(text('issues.phone_not_pakistan_mobile', locale)),
      ).toBeTruthy();
      expect(codeRequests(calls)).toEqual([]);
    },
  );

  it('gives a Pakistani landline the same words, without a request', async () => {
    const { user, calls } = renderConsole({ signedIn: false });
    await askForCode(user, '051 1234567');
    expect(await screen.findByText(text('issues.phone_not_pakistan_mobile'))).toBeTruthy();
    expect(codeRequests(calls)).toEqual([]);
  });

  it('still calls a malformed number malformed', async () => {
    const { user, calls } = renderConsole({ signedIn: false });
    await askForCode(user, '12345');
    expect(await screen.findByText(text('console.phone.error.invalid'))).toBeTruthy();
    expect(screen.queryByText(text('issues.phone_not_pakistan_mobile'))).toBeNull();
    expect(codeRequests(calls)).toEqual([]);
  });

  it('shows the message under the number when request-code refuses it', async () => {
    const { user, calls } = renderConsole({
      signedIn: false,
      handlers: {
        'auth.requestCode': (_c, id) =>
          new Response(
            JSON.stringify(
              makeApiError('validation_failed', id, {
                issues: [{ path: 'phone', code: 'phone_not_pakistan_mobile' }],
              }),
            ),
            {
              status: ERROR_CODES.validation_failed,
              headers: { 'content-type': 'application/json' },
            },
          ),
      },
    });
    await askForCode(user, '0300 0000099');
    expect(await screen.findByText(text('issues.phone_not_pakistan_mobile'))).toBeTruthy();
    expect(codeRequests(calls)).toHaveLength(1);
    expect(screen.queryByText(text('errors.validation_failed'))).toBeNull();
    expect(screen.queryByLabelText(new RegExp(text('console.signIn.code.label')))).toBeNull();
  });

  it('keeps any other refusal as the general message', async () => {
    const { user } = renderConsole({
      signedIn: false,
      forceError: (c) => (c.path === '/v1/auth/code' ? 'validation_failed' : undefined),
    });
    await askForCode(user, '0300 0000099');
    expect(await screen.findByText(text('errors.validation_failed'))).toBeTruthy();
    expect(screen.queryByText(text('issues.phone_not_pakistan_mobile'))).toBeNull();
  });
});
