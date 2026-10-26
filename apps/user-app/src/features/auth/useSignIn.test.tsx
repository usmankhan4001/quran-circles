import { describe, expect, it, vi } from 'vitest';
import { ERROR_CODES, makeApiError } from '@qc/contracts';
import { act, createWorld, renderHookInApp, signInHandlers, waitFor } from '../../test/harness';
import { secondsUntil, useSignIn } from './useSignIn';

/** The server's answer for a code it cannot use to make an account (contract `auth.verifyCode`). */
const verifyRefusedWith = (code: 'phone_required' | 'phone_in_use') => ({
  ...signInHandlers(),
  'auth.verifyCode': (_c: unknown, id: string) =>
    new Response(
      JSON.stringify(makeApiError('validation_failed', id, { issues: [{ path: 'phone', code }] })),
      { status: ERROR_CODES.validation_failed, headers: { 'content-type': 'application/json' } },
    ),
});

async function start(
  options: Parameters<typeof signInHandlers>[0] = {},
  overrides: Record<string, unknown> = {},
  hookOptions: Parameters<typeof useSignIn>[1] = {},
) {
  const world = await createWorld({
    mock: { handlers: { ...signInHandlers(options), ...overrides } },
  });
  const onDone = vi.fn();
  const hook = await renderHookInApp(() => useSignIn(onDone, hookOptions), { world });
  return { world, onDone, hook, flow: () => hook.result.current };
}

async function enterEmail(
  flow: () => ReturnType<typeof useSignIn>,
  text = ' Aisha@Example.com ',
  phone?: string,
) {
  await act(async () => flow().setEmailInput(text));
  if (phone !== undefined) await act(async () => flow().setPhoneInput(phone));
  await act(async () => {
    await flow().submitEmail();
  });
}

describe('useSignIn', () => {
  it('rejects an email that cannot be right, without calling the server', async () => {
    const { world, flow } = await start();
    await enterEmail(flow, 'aisha@');
    expect(flow().problem).toBe('invalid_email');
    expect(flow().step).toBe('email');
    expect(world.http.callsTo('POST /v1/auth/code')).toHaveLength(0);
  });

  it('asks for a code by email for a normalised address, then moves to the code step', async () => {
    const { world, flow } = await start();
    await enterEmail(flow);
    expect(flow().step).toBe('code');
    expect(flow().email).toBe('aisha@example.com');
    expect(flow().resendIn).toBe(30);
    expect(world.http.callsTo('POST /v1/auth/code')[0]!.body).toEqual({
      email: 'aisha@example.com',
      locale: 'en',
      channel: 'email',
    });
  });

  it('sends the code language the person chose', async () => {
    const world = await createWorld({ locale: 'ur', mock: { handlers: signInHandlers() } });
    const hook = await renderHookInApp(() => useSignIn(() => undefined), { world });
    await act(async () => hook.result.current.setEmailInput('aisha@example.com'));
    await act(async () => {
      await hook.result.current.submitEmail();
    });
    expect(world.http.callsTo('POST /v1/auth/code')[0]!.body).toMatchObject({ locale: 'ur' });
  });

  describe('signing up (the WhatsApp number is required)', () => {
    it('refuses to ask for a code without a usable WhatsApp number', async () => {
      const { world, flow } = await start({}, {}, { askPhone: true });
      await enterEmail(flow, 'aisha@example.com', '12');
      expect(flow().problem).toBe('invalid_phone');
      expect(flow().step).toBe('email');
      expect(world.http.callsTo('POST /v1/auth/code')).toHaveLength(0);
    });

    it('sends the number with the email, normalised, from any country', async () => {
      const { world, flow } = await start({}, {}, { askPhone: true });
      await enterEmail(flow, 'aisha@example.com', '0300 1234567');
      expect(world.http.callsTo('POST /v1/auth/code')[0]!.body).toEqual({
        email: 'aisha@example.com',
        phone: '+923001234567',
        locale: 'en',
        channel: 'email',
      });
      await act(async () => flow().changeEmail());
      await enterEmail(flow, 'aisha@example.com', '+44 7700 900123');
      expect(world.http.callsTo('POST /v1/auth/code')[1]!.body).toMatchObject({
        phone: '+447700900123',
      });
    });

    it('sends the same number again when the code is asked for again', async () => {
      const { world, flow } = await start({}, {}, { askPhone: true });
      await enterEmail(flow, 'aisha@example.com', '03001234567');
      await act(async () => {
        await flow().resend();
      });
      expect(world.http.callsTo('POST /v1/auth/code')[1]!.body).toMatchObject({
        email: 'aisha@example.com',
        phone: '+923001234567',
      });
    });

    it('goes back to the start when the number is already used by another account', async () => {
      const { flow } = await start({}, verifyRefusedWith('phone_in_use'), { askPhone: true });
      await enterEmail(flow, 'aisha@example.com', '03001234567');
      await act(async () => flow().setCodeInput('123456'));
      await act(async () => {
        await flow().submitCode();
      });
      expect(flow().problem).toBe('phone_in_use');
      expect(flow().step).toBe('email');
    });
  });

  it('says there is no account when signing in with an email that has none', async () => {
    const { flow } = await start({}, verifyRefusedWith('phone_required'));
    await enterEmail(flow);
    await act(async () => flow().setCodeInput('123456'));
    await act(async () => {
      await flow().submitCode();
    });
    expect(flow().problem).toBe('no_account');
    expect(flow().step).toBe('email');
  });

  it('shows how long to wait when asking too often', async () => {
    const { world, flow } = await start();
    world.http.failNext('POST /v1/auth/code', 'rate_limited');
    await enterEmail(flow);
    expect(flow().step).toBe('email');
    expect(flow().error).toMatchObject({ code: 'rate_limited', retryAfterSeconds: 30 });
  });

  it('keeps other validation failures as an error, not as a field message', async () => {
    const { world, flow } = await start();
    world.http.failNext('POST /v1/auth/code', 'validation_failed');
    await enterEmail(flow);
    expect(flow().problem).toBeNull();
    expect(flow().error).toMatchObject({ code: 'validation_failed' });
  });

  it('checks the code has six digits before asking the server', async () => {
    const { world, flow } = await start();
    await enterEmail(flow);
    await act(async () => flow().setCodeInput('12345'));
    await act(async () => {
      await flow().submitCode();
    });
    expect(flow().problem).toBe('invalid_code');
    expect(world.http.callsTo('POST /v1/auth/verify')).toHaveLength(0);
  });

  it('keeps the person on the code step after a wrong code', async () => {
    const { world, flow, onDone } = await start();
    await enterEmail(flow);
    await act(async () => flow().setCodeInput('000000'));
    await act(async () => {
      await flow().submitCode();
    });
    expect(flow().error?.code).toBe('otp_invalid');
    expect(flow().step).toBe('code');
    expect(world.services.auth.getState().status).toBe('signedOut');
    expect(onDone).not.toHaveBeenCalled();
  });

  it('signs in an existing person with a name and finishes', async () => {
    const { world, flow, onDone } = await start();
    await enterEmail(flow);
    await act(async () => flow().setCodeInput('123 456'));
    await act(async () => {
      await flow().submitCode();
    });
    expect(world.services.auth.getState().status).toBe('signedIn');
    expect(flow().step).toBe('done');
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(await world.tokenStore.get('qc.tokens.v1')).toContain('mock-user');
  });

  it('asks a new person for a name, which can be saved or skipped', async () => {
    const { world, flow, onDone } = await start({ isNewAccount: true, displayName: null });
    await enterEmail(flow);
    await act(async () => flow().setCodeInput('123456'));
    await act(async () => {
      await flow().submitCode();
    });
    expect(flow().step).toBe('name');
    expect(onDone).not.toHaveBeenCalled();

    await act(async () => flow().setNameInput(''));
    await act(async () => {
      await flow().submitName();
    });
    expect(flow().problem).toBe('invalid_name');

    await act(async () => flow().setNameInput('  Aisha Khan '));
    await act(async () => {
      await flow().submitName();
    });
    expect(world.http.callsTo('PATCH /v1/me')[0]!.body).toEqual({ displayName: 'Aisha Khan' });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('lets a new person skip the name', async () => {
    const { flow, onDone } = await start({ isNewAccount: true, displayName: null });
    await enterEmail(flow);
    await act(async () => flow().setCodeInput('123456'));
    await act(async () => {
      await flow().submitCode();
    });
    await act(async () => flow().skipName());
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('goes back to the email step to use another address', async () => {
    const { flow } = await start();
    await enterEmail(flow);
    await act(async () => flow().changeEmail());
    expect(flow().step).toBe('email');
    expect(flow().channel).toBeNull();
    await waitFor(() => expect(flow().resendIn).toBe(0));
  });
});

describe('secondsUntil', () => {
  it('rounds up and never goes below zero', () => {
    expect(secondsUntil(10_001, 10_000)).toBe(1);
    expect(secondsUntil(40_000, 10_000)).toBe(30);
    expect(secondsUntil(5_000, 10_000)).toBe(0);
  });
});
