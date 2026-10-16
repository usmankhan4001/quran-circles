import { describe, expect, it } from 'vitest';
import { SESSIONS } from '../../test/factories';
import { createWorld } from '../../test/harness';
import { clearLocalAccountState, deleteAccount, signOut } from './actions';

async function signedInWorld() {
  const world = await createWorld({ signedIn: true });
  world.services.cache.set('me:registrations', [{ secret: true }], false);
  world.services.cache.set('sessions:list', ['public'], true);
  await world.services.reminders.setEnabled(SESSIONS.taraweeh.id, true);
  await world.services.push.enable(world.services.api, 'en');
  return world;
}

describe('leaving the account', () => {
  it('signing out clears the tokens, saved copies, reminders and push on this device', async () => {
    const world = await signedInWorld();
    await signOut(world.services);
    expect(world.http.callsTo('POST /v1/auth/sign-out')).toHaveLength(1);
    expect(world.services.auth.getState().status).toBe('signedOut');
    expect(await world.tokenStore.get('qc.tokens.v1')).toBeNull();
    expect(world.services.cache.get('me:registrations')).toBeUndefined();
    expect(world.services.cache.get('sessions:list')).toBeUndefined();
    expect(world.services.reminders.getOptedIn().size).toBe(0);
    expect(await world.services.push.isEnabled()).toBe(false);
    expect(world.deviceStore.keys().filter((k) => k.startsWith('qc.cache'))).toEqual([]);
  });

  it('signs out here even when the server cannot be reached', async () => {
    const world = await signedInWorld();
    world.http.setOffline(true);
    await signOut(world.services);
    expect(world.services.auth.getState().status).toBe('signedOut');
    expect(await world.tokenStore.get('qc.tokens.v1')).toBeNull();
  });

  it('deleting the account asks the server to delete, then clears the device', async () => {
    const world = await signedInWorld();
    await deleteAccount(world.services);
    const call = world.http.callsTo('DELETE /v1/me')[0]!;
    expect(call.path).toBe('/v1/me');
    expect(call.body).toEqual({ confirm: true });
    expect(world.services.auth.getState().status).toBe('signedOut');
    expect(world.services.cache.get('me:registrations')).toBeUndefined();
  });

  it('does not clear the device when the server refuses to delete the account', async () => {
    const world = await signedInWorld();
    world.http.failNext('DELETE /v1/me', 'internal_error');
    await expect(deleteAccount(world.services)).rejects.toMatchObject({ code: 'internal_error' });
    expect(world.services.auth.getState().status).toBe('signedIn');
    expect(world.services.cache.get('me:registrations')).toBeDefined();
  });

  it('can be run twice without harm', async () => {
    const world = await signedInWorld();
    await clearLocalAccountState(world.services);
    await expect(clearLocalAccountState(world.services)).resolves.toBeUndefined();
  });
});
