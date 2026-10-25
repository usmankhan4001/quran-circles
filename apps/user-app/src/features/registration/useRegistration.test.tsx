import { describe, expect, it } from 'vitest';
import { messages } from '@qc/i18n';
import type { Session } from '@qc/contracts';
import { errorMessageKey } from '../../core/errors';
import { AREA_SADDAR, CITY_RAWALPINDI, SESSIONS } from '../../test/factories';
import { act, createWorld, renderHookInApp, type TestWorld } from '../../test/harness';
import { useRegistration } from './useRegistration';

async function start(
  session: Session,
  world?: TestWorld,
  displayName: string | null = 'Aisha Khan',
) {
  const w = world ?? (await createWorld({ signedIn: true, cityId: CITY_RAWALPINDI.id }));
  const hook = await renderHookInApp(() => useRegistration({ session, displayName }), { world: w });
  return { world: w, hook, flow: () => hook.result.current };
}

async function fill(flow: () => ReturnType<typeof useRegistration>, section = true) {
  await act(async () => {
    flow().setForm({
      areaId: AREA_SADDAR.id,
      partySize: 3,
      ...(section ? { section: 'family' as const } : {}),
    });
  });
}

describe('useRegistration', () => {
  it('starts with the section chosen when the session has only one, and consent off', async () => {
    const { flow } = await start(SESSIONS.womenFull);
    expect(flow().form).toMatchObject({ section: 'women', allowWhatsapp: false, partySize: 1 });
  });

  it('shows the problems under the fields and sends nothing while the form is not complete', async () => {
    const { world, flow } = await start(SESSIONS.taraweeh);
    await act(async () => {
      await flow().submit();
    });
    expect(Object.keys(flow().problems).sort()).toEqual(['area', 'section']);
    expect(world.http.callsTo('POST /v1/registrations')).toHaveLength(0);
  });

  it('clears a problem when its field is edited', async () => {
    const { flow } = await start(SESSIONS.taraweeh);
    await act(async () => {
      await flow().submit();
    });
    await act(async () => flow().setForm({ areaId: AREA_SADDAR.id }));
    expect(flow().problems).not.toHaveProperty('area');
    expect(flow().problems).toHaveProperty('section');
  });

  it('registers with the chosen details and the consent exactly as ticked', async () => {
    const { world, flow } = await start(SESSIONS.taraweeh);
    await fill(flow);
    await act(async () => flow().setForm({ allowWhatsapp: true }));
    await act(async () => {
      await flow().submit();
    });
    const call = world.http.callsTo('POST /v1/registrations')[0]!;
    expect(call.body).toEqual({
      sessionId: SESSIONS.taraweeh.id,
      areaId: AREA_SADDAR.id,
      section: 'family',
      partySize: 3,
      allowWhatsapp: true,
    });
    expect(flow().result).toMatchObject({ status: 'confirmed', sessionId: SESSIONS.taraweeh.id });
    expect(flow().error).toBeUndefined();
  });

  it('does not tick the WhatsApp consent for the person', async () => {
    const { world, flow } = await start(SESSIONS.taraweeh);
    await fill(flow);
    await act(async () => {
      await flow().submit();
    });
    expect(world.http.callsTo('POST /v1/registrations')[0]!.body).toMatchObject({
      allowWhatsapp: false,
    });
  });

  it('sends the name only for an account that has none', async () => {
    const { world, flow } = await start(SESSIONS.taraweeh, undefined, null);
    expect(flow().needsName).toBe(true);
    await fill(flow);
    await act(async () => flow().setForm({ name: 'Aisha Khan' }));
    await act(async () => {
      await flow().submit();
    });
    expect(world.http.callsTo('POST /v1/registrations')[0]!.body).toMatchObject({
      name: 'Aisha Khan',
    });
  });

  it('puts the person on the waiting list when the session is full', async () => {
    const { flow } = await start(SESSIONS.womenFull);
    await act(async () => flow().setForm({ areaId: AREA_SADDAR.id }));
    await act(async () => {
      await flow().submit();
    });
    expect(flow().result).toMatchObject({ status: 'waitlisted', waitlistPosition: 3 });
  });

  it('remembers the area for next time and refreshes the person’s own lists', async () => {
    const { world, flow } = await start(SESSIONS.taraweeh);
    world.services.cache.set('me:registrations', [], false);
    await fill(flow);
    await act(async () => {
      await flow().submit();
    });
    await act(async () => undefined);
    expect(world.services.preferences.get().areaId).toBe(AREA_SADDAR.id);
    expect(world.services.cache.isFresh('me:registrations', 60_000)).toBe(false);
  });

  it.each([
    ['already_registered', /already joining/i],
    ['session_full', /full/i],
    ['registration_closed', /closed/i],
    ['session_cancelled', /cancelled/i],
    ['occurrence_in_past', /already taken place/i],
  ] as const)('maps %s to a message in both languages', async (code, pattern) => {
    const { world, flow } = await start(SESSIONS.taraweeh);
    await fill(flow);
    world.http.failNext('POST /v1/registrations', code);
    await act(async () => {
      await flow().submit();
    });
    expect(flow().error?.code).toBe(code);
    expect(flow().result).toBeNull();
    expect(flow().signInRequired).toBe(false);
    const key = errorMessageKey(flow().error!.code);
    expect(messages.en[key]).toMatch(pattern);
    expect(messages.ur[key]).toBeTruthy();
    expect(messages.ur[key]).not.toBe(messages.en[key]);
  });

  it('can try again after a failure', async () => {
    const { world, flow } = await start(SESSIONS.taraweeh);
    await fill(flow);
    world.http.failNext('POST /v1/registrations', 'internal_error');
    await act(async () => {
      await flow().submit();
    });
    expect(flow().error?.code).toBe('internal_error');
    await act(async () => {
      await flow().submit();
    });
    expect(flow().error).toBeUndefined();
    expect(flow().result?.status).toBe('confirmed');
  });

  it('asks to sign in again when the sign-in has run out', async () => {
    const world = await createWorld({
      signedIn: true,
      tokens: {
        accessToken: 'mock-expired',
        accessTokenExpiresAt: '2099-01-01T00:00:00Z',
        refreshToken: 'a-refresh-token',
        refreshTokenExpiresAt: '2099-02-01T00:00:00Z',
      },
    });
    world.http.failNext('POST /v1/auth/refresh', 'refresh_token_invalid');
    const { flow } = await start(SESSIONS.taraweeh, world);
    await fill(flow);
    await act(async () => {
      await flow().submit();
    });
    expect(flow().signInRequired).toBe(true);
    expect(world.services.auth.getState().status).toBe('signedOut');
  });
});
