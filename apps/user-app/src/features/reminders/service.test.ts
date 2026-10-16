import { describe, expect, it } from 'vitest';
import { createTranslator } from '../../i18n/translate';
import { SESSIONS, occurrencesOf, registrationFor } from '../../test/factories';
import { NOW, createWorld } from '../../test/harness';
import { DEVICE_KEY, REMINDERS_KEY } from './service';

const handlers = {
  'sessions.occurrences': (c: unknown) => ({
    items: occurrencesOf(
      Object.values(SESSIONS).find(
        (s) => s.id === (c as { params: { sessionId: string } }).params.sessionId,
      )!,
    ),
  }),
};

describe('RemindersService', () => {
  it('starts with no reminders and remembers the ones switched on across restarts', async () => {
    const world = await createWorld({ signedIn: true });
    expect(world.services.reminders.isEnabled(SESSIONS.taraweeh.id)).toBe(false);
    await world.services.reminders.setEnabled(SESSIONS.taraweeh.id, true);
    expect(world.services.reminders.isEnabled(SESSIONS.taraweeh.id)).toBe(true);
    expect(await world.deviceStore.get(REMINDERS_KEY)).toContain(SESSIONS.taraweeh.id);

    const next = await createWorld({ signedIn: true, deviceStore: world.deviceStore });
    expect(next.services.reminders.isEnabled(SESSIONS.taraweeh.id)).toBe(true);
  });

  it('asks permission when turning on and does not turn on if it is refused', async () => {
    const world = await createWorld({ signedIn: true });
    world.scheduler.permission = 'denied';
    const result = await world.services.reminders.setEnabled(SESSIONS.taraweeh.id, true);
    expect(result).toBe('denied');
    expect(world.services.reminders.isEnabled(SESSIONS.taraweeh.id)).toBe(false);
  });

  it('turns off without asking anything', async () => {
    const world = await createWorld({ signedIn: true });
    await world.services.reminders.setEnabled(SESSIONS.taraweeh.id, true);
    world.scheduler.permission = 'denied';
    expect(await world.services.reminders.setEnabled(SESSIONS.taraweeh.id, false)).toBe('granted');
    expect(world.services.reminders.isEnabled(SESSIONS.taraweeh.id)).toBe(false);
  });

  it('schedules a notification before each coming session with the session’s details', async () => {
    const world = await createWorld({ signedIn: true, mock: { handlers } });
    await world.services.reminders.setEnabled(SESSIONS.taraweeh.id, true);
    const count = await world.services.reminders.sync({
      api: world.services.api,
      registrations: [registrationFor(SESSIONS.taraweeh)],
      locale: 'en',
      t: createTranslator('en'),
      now: NOW,
    });
    expect(count).toBeGreaterThan(0);
    expect(world.scheduler.scheduled).toHaveLength(count);
    const first = world.scheduler.scheduled[0]!;
    expect(first.title).toBe('Session reminder');
    expect(first.body).toContain(SESSIONS.taraweeh.title.en);
    expect(first.body).toContain(SESSIONS.taraweeh.venue.name.en);
    expect(first.sessionId).toBe(SESSIONS.taraweeh.id);
    expect(first.fireAt.getTime()).toBeGreaterThan(NOW.getTime());
  });

  it('schedules nothing for a session whose reminders are off', async () => {
    const world = await createWorld({ signedIn: true, mock: { handlers } });
    const count = await world.services.reminders.sync({
      api: world.services.api,
      registrations: [registrationFor(SESSIONS.taraweeh)],
      locale: 'en',
      t: createTranslator('en'),
      now: NOW,
    });
    expect(count).toBe(0);
    expect(world.scheduler.scheduled).toEqual([]);
  });

  it('does nothing where the device cannot schedule reminders (the web app)', async () => {
    const world = await createWorld({ signedIn: true, mock: { handlers } });
    world.scheduler.supported = false;
    await world.services.reminders.setEnabled(SESSIONS.taraweeh.id, true);
    const count = await world.services.reminders.sync({
      api: world.services.api,
      registrations: [registrationFor(SESSIONS.taraweeh)],
      locale: 'en',
      t: createTranslator('en'),
      now: NOW,
    });
    expect(count).toBe(0);
    expect(world.http.callsTo('GET /v1/sessions')).toHaveLength(0);
  });

  it('forgets everything on reset: opt-ins and the schedule', async () => {
    const world = await createWorld({ signedIn: true });
    await world.services.reminders.setEnabled(SESSIONS.taraweeh.id, true);
    await world.services.reminders.reset();
    expect(world.services.reminders.getOptedIn().size).toBe(0);
    expect(await world.deviceStore.get(REMINDERS_KEY)).toBeNull();
    expect(world.scheduler.cancelled).toBe(1);
  });
});

describe('PushService', () => {
  it('registers this device with the contract’s endpoint and remembers the device id', async () => {
    const world = await createWorld({ signedIn: true });
    const result = await world.services.push.enable(world.services.api, 'ur');
    expect(result).toBe('granted');
    expect(world.http.callsTo('PUT /v1/me/devices')[0]!.body).toEqual({
      platform: 'web',
      provider: 'webpush',
      token: 'test-subscription',
      locale: 'ur',
    });
    expect(await world.services.push.isEnabled()).toBe(true);
  });

  it('registers nothing when the person refuses permission', async () => {
    const world = await createWorld({ signedIn: true });
    world.registrar.result = 'denied';
    expect(await world.services.push.enable(world.services.api, 'en')).toBe('denied');
    expect(world.http.callsTo('PUT /v1/me/devices')).toHaveLength(0);
    expect(await world.services.push.isEnabled()).toBe(false);
  });

  it('says so where push is not possible', async () => {
    const world = await createWorld({ signedIn: true });
    world.registrar.supported = false;
    expect(world.services.push.supported).toBe(false);
    expect(await world.services.push.enable(world.services.api, 'en')).toBe('unsupported');
  });

  it('removes the device on the server and forgets it', async () => {
    const world = await createWorld({ signedIn: true });
    await world.services.push.enable(world.services.api, 'en');
    await world.services.push.disable(world.services.api);
    expect(world.http.callsTo('DELETE /v1/me/devices/')).toHaveLength(1);
    expect(await world.deviceStore.get(DEVICE_KEY)).toBeNull();
    expect(await world.services.push.isEnabled()).toBe(false);
  });
});
