import { describe, expect, it, vi } from 'vitest';
import { ERROR_CODES, makeApiError } from '@qc/contracts';
import { act, createWorld, renderHookInApp, signInHandlers, waitFor } from '../../test/harness';
import { secondsUntil, useSignIn } from './useSignIn';

/** The server's answer for a number it will not send a code to (contract `auth.requestCode`). */
const notPakistanMobile = {
  'auth.requestCode': (_c: unknown, id: string) =>
    new Response(
      JSON.stringify(
        makeApiError('validation_failed', id, {
          issues: [{ path: 'phone', code: 'phone_not_pakistan_mobile' }],
        }),
      ),
      { status: ERROR_CODES.validation_failed, headers: { 'content-type': 'application/json' } },
    ),
};

async function start(
  options: Parameters<typeof signInHandlers>[0] = {},
  overrides: Record<string, unknown> = {},
) {
  const world = await createWorld({
    mock: { handlers: { ...signInHandlers(options), ...overrides } },
  });
  const onDone = vi.fn();
  const hook = await renderHookInApp(() => useSignIn(onDone), { world });
  return { world, onDone, hook, flow: () => hook.result.current };
}

async function enterPhone(flow: () => ReturnType<typeof useSignIn>, text = '0300 1234567') {
  await act(async () => flow().setPhoneInput(text));
  await act(async () => {
    await flow().submitPhone();
  });
}

describe('useSignIn', () => {
  it('rejects a phone number that cannot be right, without calling the server', async () => {
    const { world, flow } = await start();
    await enterPhone(flow, '12');
    expect(flow().problem).toBe('invalid_phone');
    expect(flow().step).toBe('phone');
    expect(world.http.callsTo('POST /v1/auth/code')).toHaveLength(0);
  });

  it('asks for a code on WhatsApp for a normalised number, then moves to the code step', async () => {
    const { world, flow } = await start();
    await enterPhone(flow);
    expect(flow().step).toBe('code');
    expect(flow().channel).toBe('whatsapp');
    expect(flow().resendIn).toBe(30);
    expect(world.http.callsTo('POST /v1/auth/code')[0]!.body).toEqual({
      phone: '+923001234567',
      locale: 'en',
      channel: 'whatsapp',
    });
  });

  it('sends the code language the person chose', async () => {
    const world = await createWorld({ locale: 'ur', mock: { handlers: signInHandlers() } });
    const hook = await renderHookInApp(() => useSignIn(() => undefined), { world });
    await act(async () => hook.result.current.setPhoneInput('03001234567'));
    await act(async () => {
      await hook.result.current.submitPhone();
    });
    expect(world.http.callsTo('POST /v1/auth/code')[0]!.body).toMatchObject({ locale: 'ur' });
  });

  it('can send the code by SMS instead', async () => {
    const { world, flow } = await start();
    await enterPhone(flow);
    await act(async () => {
      await flow().resend('sms');
    });
    expect(world.http.callsTo('POST /v1/auth/code')[1]!.body).toMatchObject({ channel: 'sms' });
    expect(flow().channel).toBe('sms');
  });

  it('shows how long to wait when asking too often', async () => {
    const { world, flow } = await start();
    world.http.failNext('POST /v1/auth/code', 'rate_limited');
    await enterPhone(flow);
    expect(flow().step).toBe('phone');
    expect(flow().error).toMatchObject({ code: 'rate_limited', retryAfterSeconds: 30 });
  });

  it('says a number from abroad cannot sign in, without calling the server', async () => {
    const { world, flow } = await start();
    await enterPhone(flow, '+44 7700 900123');
    expect(flow().problem).toBe('phone_not_pakistan_mobile');
    expect(flow().error).toBeUndefined();
    expect(flow().step).toBe('phone');
    expect(world.http.callsTo('POST /v1/auth/code')).toHaveLength(0);
  });

  it('shows the server’s word when it refuses the number as not a Pakistani mobile', async () => {
    const { world, flow } = await start({}, notPakistanMobile);
    await enterPhone(flow);
    expect(world.http.callsTo('POST /v1/auth/code')).toHaveLength(1);
    expect(flow().problem).toBe('phone_not_pakistan_mobile');
    expect(flow().error).toBeUndefined();
    expect(flow().step).toBe('phone');
  });

  it('keeps other validation failures as an error, not as the phone message', async () => {
    const { world, flow } = await start();
    world.http.failNext('POST /v1/auth/code', 'validation_failed');
    await enterPhone(flow);
    expect(flow().problem).toBeNull();
    expect(flow().error).toMatchObject({ code: 'validation_failed' });
  });

  it('checks the code has six digits before asking the server', async () => {
    const { world, flow } = await start();
    await enterPhone(flow);
    await act(async () => flow().setCodeInput('12345'));
    await act(async () => {
      await flow().submitCode();
    });
    expect(flow().problem).toBe('invalid_code');
    expect(world.http.callsTo('POST /v1/auth/verify')).toHaveLength(0);
  });

  it('keeps the person on the code step after a wrong code', async () => {
    const { world, flow, onDone } = await start();
    await enterPhone(flow);
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
    await enterPhone(flow);
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
    await enterPhone(flow);
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
    await enterPhone(flow);
    await act(async () => flow().setCodeInput('123456'));
    await act(async () => {
      await flow().submitCode();
    });
    await act(async () => flow().skipName());
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('goes back to the phone step to use another number', async () => {
    const { flow } = await start();
    await enterPhone(flow);
    await act(async () => flow().changeNumber());
    expect(flow().step).toBe('phone');
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
