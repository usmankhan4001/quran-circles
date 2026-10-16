import { describe, expect, it } from 'vitest';
import type { ContentApi } from '../account/api';
import { createMemoryStorage } from '../storage/memory';
import { createFakeAccountServer } from '../test/fakeAccount';
import { createClock } from '../test/fakes';
import { createReadingPositionService } from './position';

const setup = (signedIn = false) => {
  const clock = createClock();
  const server = createFakeAccountServer(clock.now);
  const storage = createMemoryStorage();
  let current: ContentApi | null = signedIn ? server.api : null;
  const service = createReadingPositionService({ storage, getApi: () => current, now: clock.now });
  return {
    clock,
    server,
    storage,
    service,
    signIn: () => {
      current = server.api;
    },
  };
};

describe('reading position while signed out', () => {
  it('starts empty', async () => {
    expect(await setup().service.getLocal()).toBeNull();
  });

  it('saves on the device and makes no request', async () => {
    const { service, server } = setup();
    const saved = await service.save(18, 10);
    expect(saved).toMatchObject({ surah: 18, ayah: 10 });
    expect(await service.getLocal()).toMatchObject({ surah: 18, ayah: 10 });
    expect(server.requests).toEqual([]);
  });

  it('survives a restart', async () => {
    const { service, storage, clock } = setup();
    await service.save(36, 5);
    const reopened = createReadingPositionService({ storage, getApi: () => null, now: clock.now });
    expect(await reopened.getLocal()).toMatchObject({ surah: 36, ayah: 5 });
  });

  it('refuses an ayah that does not exist', async () => {
    const { service } = setup();
    await expect(service.save(1, 8)).rejects.toBeInstanceOf(RangeError);
    await expect(service.save(0, 1)).rejects.toBeInstanceOf(RangeError);
    await expect(service.save(2, 0)).rejects.toBeInstanceOf(RangeError);
    expect(await service.getLocal()).toBeNull();
  });

  it('ignores a damaged or impossible stored value', async () => {
    const { service, storage } = setup();
    await storage.setItem('qc.reading.position.v1', 'garbage');
    expect(await service.getLocal()).toBeNull();
    await storage.setItem(
      'qc.reading.position.v1',
      JSON.stringify({ surah: 1, ayah: 99, updatedAt: '2026-01-01T00:00:00.000Z', dirty: false }),
    );
    expect(await service.getLocal()).toBeNull();
  });

  it('sync returns the device value without a request', async () => {
    const { service, server } = setup();
    await service.save(2, 2);
    expect(await service.sync()).toMatchObject({ surah: 2, ayah: 2 });
    expect(server.requests).toEqual([]);
  });

  it('tells listeners when it changes', async () => {
    const { service } = setup();
    let calls = 0;
    const off = service.subscribe(() => calls++);
    await service.save(1, 1);
    off();
    await service.save(1, 2);
    expect(calls).toBe(1);
  });
});

describe('reading position while signed in', () => {
  it('sends the position to the account', async () => {
    const { service, server } = setup(true);
    await service.save(18, 10);
    expect(server.requests).toEqual(['PUT /v1/me/reading-position']);
    expect(server.position).toMatchObject({ surah: 18, ayah: 10 });
  });

  it('keeps the position on the device when the connection is down, then sends it on sync', async () => {
    const { service, server } = setup(true);
    server.offline = true;
    await service.save(18, 10);
    expect(await service.getLocal()).toMatchObject({ surah: 18, ayah: 10 });
    server.offline = false;
    expect(await service.sync()).toMatchObject({ surah: 18, ayah: 10 });
    expect(server.position).toMatchObject({ surah: 18, ayah: 10 });
  });

  it('adopts the account position when the device has none', async () => {
    const { service, server } = setup(true);
    server.position = { surah: 55, ayah: 3, updatedAt: '2026-10-01T00:00:00.000Z' };
    expect(await service.sync()).toMatchObject({ surah: 55, ayah: 3 });
    expect(await service.getLocal()).toMatchObject({ surah: 55, ayah: 3 });
  });

  it('adopts the account position when it is newer than the one on the device', async () => {
    const { service, server, clock } = setup(true);
    server.offline = true;
    await service.save(2, 1);
    server.offline = false;
    // Move the account position to a time after the device save.
    server.position = { surah: 67, ayah: 1, updatedAt: new Date(clock.now().getTime() + 60_000).toISOString() };
    // The device position was saved while offline, so it is "dirty"; the newer account one still wins.
    expect(await service.sync()).toMatchObject({ surah: 67, ayah: 1 });
  });

  it('keeps the device position when it is newer, and sends it', async () => {
    const { service, server, clock } = setup(true);
    server.position = { surah: 67, ayah: 1, updatedAt: '2026-01-01T00:00:00.000Z' };
    server.offline = true;
    await service.save(2, 1);
    server.offline = false;
    clock.advance(1000);
    expect(await service.sync()).toMatchObject({ surah: 2, ayah: 1 });
    expect(server.position).toMatchObject({ surah: 2, ayah: 1 });
  });

  it('copes with an account that has no position yet', async () => {
    const { service } = setup(true);
    expect(await service.sync()).toBeNull();
  });

  it('falls back to the device value when the account cannot be reached', async () => {
    const { service, server } = setup(true);
    await service.save(3, 3);
    server.offline = true;
    expect(await service.sync()).toMatchObject({ surah: 3, ayah: 3 });
  });

  it('merges a position saved while signed out at sign-in', async () => {
    const { service, server, signIn } = setup(false);
    await service.save(18, 1);
    signIn();
    await service.sync();
    expect(server.position).toMatchObject({ surah: 18, ayah: 1 });
  });

  it('forgets the position when the person signs out', async () => {
    const { service } = setup(true);
    await service.save(18, 1);
    await service.signOut();
    expect(await service.getLocal()).toBeNull();
  });
});
