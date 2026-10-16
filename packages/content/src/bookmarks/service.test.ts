import { describe, expect, it } from 'vitest';
import type { ContentApi } from '../account/api';
import { createMemoryStorage } from '../storage/memory';
import { createFakeAccountServer } from '../test/fakeAccount';
import { createClock } from '../test/fakes';
import { createBookmarkService } from './service';

const setup = (signedIn = false) => {
  const clock = createClock();
  const server = createFakeAccountServer(clock.now);
  const storage = createMemoryStorage();
  let current: ContentApi | null = signedIn ? server.api : null;
  let n = 0;
  const service = createBookmarkService({
    storage,
    getApi: () => current,
    now: () => {
      clock.advance(1000);
      return clock.now();
    },
    newId: () => `local-${++n}`,
  });
  return {
    server,
    storage,
    service,
    signIn: () => {
      current = server.api;
    },
    signOutNow: () => {
      current = null;
    },
  };
};

describe('bookmarks while signed out', () => {
  it('keeps bookmarks on the device and makes no request', async () => {
    const { service, server } = setup();
    const entry = await service.add({ kind: 'ayah', surah: 2, ayah: 255 });
    expect(entry).toMatchObject({ kind: 'ayah', surah: 2, ayah: 255, synced: false });
    expect(await service.list()).toHaveLength(1);
    expect(server.requests).toEqual([]);
  });

  it('survives a restart', async () => {
    const { service, storage } = setup();
    await service.add({ kind: 'ayah', surah: 36, ayah: 1 });
    const reopened = createBookmarkService({ storage, getApi: () => null });
    expect((await reopened.list()).map((b) => [b.surah, b.ayah])).toEqual([[36, 1]]);
  });

  it('does not add the same ayah twice', async () => {
    const { service } = setup();
    const first = await service.add({ kind: 'ayah', surah: 1, ayah: 1 });
    const second = await service.add({ kind: 'ayah', surah: 1, ayah: 1 });
    expect(second.id).toBe(first.id);
    expect(await service.list()).toHaveLength(1);
  });

  it('toggles an ayah on and off and reports whether it is bookmarked', async () => {
    const { service } = setup();
    expect(await service.isBookmarked({ surah: 18, ayah: 10 })).toBe(false);
    expect(await service.toggleAyah({ surah: 18, ayah: 10 })).toBe(true);
    expect(await service.isBookmarked({ surah: 18, ayah: 10 })).toBe(true);
    expect(await service.toggleAyah({ surah: 18, ayah: 10 })).toBe(false);
    expect(await service.list()).toEqual([]);
  });

  it('lists the newest first', async () => {
    const { service } = setup();
    await service.add({ kind: 'ayah', surah: 1, ayah: 1 });
    await service.add({ kind: 'ayah', surah: 2, ayah: 2 });
    expect((await service.list()).map((b) => b.surah)).toEqual([2, 1]);
  });

  it('supports surah and para bookmarks', async () => {
    const { service } = setup();
    await service.add({ kind: 'surah', surah: 18 });
    await service.add({ kind: 'para', para: 30, note: 'second half' });
    const list = await service.list();
    expect(list.find((b) => b.kind === 'para')).toMatchObject({ para: 30, note: 'second half' });
    expect(list.find((b) => b.kind === 'surah')).toMatchObject({ surah: 18, ayah: null });
  });

  it('rejects input the contract does not allow, and bookmarks with no target', async () => {
    const { service } = setup();
    await expect(service.add({ kind: 'ayah', surah: 0, ayah: 1 })).rejects.toBeDefined();
    await expect(service.add({ kind: 'ayah', surah: 115, ayah: 1 })).rejects.toBeDefined();
    await expect(service.add({ kind: 'ayah', surah: 2 })).rejects.toBeInstanceOf(RangeError);
    await expect(service.add({ kind: 'para' })).rejects.toBeInstanceOf(RangeError);
    await expect(service.add({ kind: 'surah', note: 'x'.repeat(501), surah: 1 })).rejects.toBeDefined();
    expect(await service.list()).toEqual([]);
  });

  it('removing an id that does not exist does nothing', async () => {
    const { service } = setup();
    await expect(service.remove('nope')).resolves.toBeUndefined();
  });

  it('sync does nothing while signed out', async () => {
    const { service, server } = setup();
    expect(await service.sync()).toEqual({ ok: false, reason: 'signed_out' });
    expect(server.requests).toEqual([]);
  });

  it('tells listeners about changes, until they unsubscribe', async () => {
    const { service } = setup();
    let calls = 0;
    const off = service.subscribe(() => calls++);
    await service.add({ kind: 'ayah', surah: 1, ayah: 1 });
    expect(calls).toBeGreaterThan(0);
    const seen = calls;
    off();
    await service.add({ kind: 'ayah', surah: 1, ayah: 2 });
    expect(calls).toBe(seen);
  });

  it('copes with a damaged store by starting empty', async () => {
    const { service, storage } = setup();
    await storage.setItem('qc.bookmarks.v1', '{"version":1,"items":"x"}');
    expect(await service.list()).toEqual([]);
    await service.add({ kind: 'ayah', surah: 1, ayah: 1 });
    expect(await service.list()).toHaveLength(1);
  });
});

describe('bookmarks while signed in', () => {
  it('sends a new bookmark to the account', async () => {
    const { service, server } = setup(true);
    const entry = await service.add({ kind: 'ayah', surah: 2, ayah: 255 });
    expect(entry.synced).toBe(true);
    expect(server.requests).toEqual(['POST /v1/me/bookmarks']);
    expect(server.bookmarks).toHaveLength(1);
    expect(server.bookmarks[0]).toMatchObject({ surah: 2, ayah: 255 });
  });

  it('keeps the bookmark on the device when the connection is down, and sends it on the next sync', async () => {
    const { service, server } = setup(true);
    server.offline = true;
    const entry = await service.add({ kind: 'ayah', surah: 3, ayah: 7 });
    expect(entry.synced).toBe(false);
    expect(await service.list()).toHaveLength(1);
    expect(await service.sync()).toEqual({ ok: false, reason: 'offline' });
    server.offline = false;
    expect(await service.sync()).toMatchObject({ ok: true, imported: 1 });
    expect(server.bookmarks).toHaveLength(1);
    const [only] = await service.list();
    expect(only?.synced).toBe(true);
  });

  it('removes a bookmark from the account too', async () => {
    const { service, server } = setup(true);
    const entry = await service.add({ kind: 'ayah', surah: 1, ayah: 1 });
    await service.remove(entry.id);
    expect(server.bookmarks).toEqual([]);
    expect(await service.list()).toEqual([]);
  });

  it('remembers a removal made offline and tells the server on the next sync', async () => {
    const { service, server } = setup(true);
    const entry = await service.add({ kind: 'ayah', surah: 1, ayah: 1 });
    server.offline = true;
    await service.remove(entry.id);
    expect(await service.list()).toEqual([]);
    expect(server.bookmarks).toHaveLength(1);
    server.offline = false;
    expect(await service.sync()).toMatchObject({ ok: true });
    expect(server.bookmarks).toEqual([]);
    expect(await service.list()).toEqual([]); // and it does not come back
  });

  it('does not bring back a bookmark it has a pending removal for', async () => {
    const { service, server } = setup(true);
    const entry = await service.add({ kind: 'ayah', surah: 5, ayah: 5 });
    server.offline = true;
    await service.remove(entry.id);
    server.offline = false;
    // The delete is still pending when the list is fetched only if the delete failed; here it works.
    await service.sync();
    expect(await service.list()).toEqual([]);
  });

  it('treats a bookmark that is already gone on the server as removed', async () => {
    const { service, server } = setup(true);
    const entry = await service.add({ kind: 'ayah', surah: 1, ayah: 1 });
    server.bookmarks.length = 0; // removed on another device
    await service.remove(entry.id);
    expect(await service.list()).toEqual([]);
    await service.sync();
    expect(server.requests.some((r) => r.startsWith('DELETE'))).toBe(true);
  });

  it('pulls in bookmarks made on another device', async () => {
    const { service, server } = setup(true);
    server.bookmarks.push({
      id: '00000000-0000-4000-8000-0000000000aa',
      kind: 'ayah',
      surah: 112,
      ayah: 1,
      para: null,
      note: null,
      createdAt: '2026-10-01T00:00:00.000Z',
    });
    expect(await service.sync()).toMatchObject({ ok: true });
    expect((await service.list()).map((b) => [b.surah, b.ayah, b.synced])).toEqual([[112, 1, true]]);
  });

  it('drops a bookmark that was deleted on another device', async () => {
    const { service, server } = setup(true);
    await service.add({ kind: 'ayah', surah: 1, ayah: 1 });
    server.bookmarks.length = 0;
    await service.sync();
    expect(await service.list()).toEqual([]);
  });

  it('merges device-only bookmarks into the account at sign-in without duplicating', async () => {
    const { service, server, signIn } = setup(false);
    await service.add({ kind: 'ayah', surah: 2, ayah: 255 });
    await service.add({ kind: 'ayah', surah: 18, ayah: 1 });
    server.bookmarks.push({
      id: '00000000-0000-4000-8000-0000000000bb',
      kind: 'ayah',
      surah: 2,
      ayah: 255,
      para: null,
      note: null,
      createdAt: '2026-09-01T00:00:00.000Z',
    });
    signIn();
    expect(await service.sync()).toMatchObject({ ok: true, imported: 1 });
    expect(server.bookmarks).toHaveLength(2);
    const list = await service.list();
    expect(list).toHaveLength(2);
    expect(list.every((b) => b.synced)).toBe(true);
  });

  it('takes a conflict on create as "already there" and settles it on sync', async () => {
    const { service, server } = setup(true);
    server.failNext = { status: 409, code: 'conflict' };
    const entry = await service.add({ kind: 'ayah', surah: 7, ayah: 7 });
    expect(entry.synced).toBe(false);
    expect(await service.sync()).toMatchObject({ ok: true });
    expect((await service.list())[0]?.synced).toBe(true);
  });

  it('reports a rejected sign-in as signed out', async () => {
    const { service, server } = setup(true);
    await service.add({ kind: 'ayah', surah: 1, ayah: 1 });
    server.failNext = { status: 401, code: 'token_expired' };
    expect(await service.sync()).toEqual({ ok: false, reason: 'signed_out' });
  });

  it('reports other failures without losing anything', async () => {
    const { service, server } = setup(true);
    server.offline = true;
    await service.add({ kind: 'ayah', surah: 1, ayah: 1 });
    server.offline = false;
    server.failNext = { status: 400, code: 'validation_failed' };
    expect(await service.sync()).toEqual({ ok: false, reason: 'failed' });
    expect(await service.list()).toHaveLength(1);
  });

  it('takes a bookmark off the server when it was removed on the device while the request was on its way', async () => {
    const { server } = setup(true);
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const slow = createBookmarkService({
      storage: createMemoryStorage(),
      getApi: () => ({
        ...server.api,
        bookmarks: {
          ...server.api.bookmarks,
          create: async (req) => {
            await gate; // the server answers only after the person removed the item
            return server.api.bookmarks.create(req);
          },
        },
      }),
    });
    const saved = new Promise<void>((resolve) => {
      const off = slow.subscribe(() => {
        off();
        resolve();
      });
    });
    const pending = slow.add({ kind: 'ayah', surah: 9, ayah: 9 });
    await saved; // the bookmark exists on the device; the request is waiting on the gate
    const [only] = await slow.list();
    expect(only?.synced).toBe(false);
    await slow.remove(only?.id ?? '');
    release();
    await pending;
    expect(await slow.list()).toEqual([]);
    expect(await slow.sync()).toMatchObject({ ok: true });
    expect(server.bookmarks).toEqual([]);
  });
});

describe('signing out', () => {
  it('forgets bookmarks that belong to the account and keeps device-only ones', async () => {
    const { service, server, signOutNow } = setup(true);
    await service.add({ kind: 'ayah', surah: 1, ayah: 1 }); // synced
    server.offline = true;
    await service.add({ kind: 'ayah', surah: 2, ayah: 2 }); // not synced
    signOutNow();
    await service.signOut();
    expect((await service.list()).map((b) => b.surah)).toEqual([2]);
  });

  it('drops pending removals so they cannot reach the next account', async () => {
    const { service, server, signOutNow, signIn } = setup(true);
    const entry = await service.add({ kind: 'ayah', surah: 1, ayah: 1 });
    server.offline = true;
    await service.remove(entry.id);
    signOutNow();
    await service.signOut();
    server.offline = false;
    server.requests.length = 0;
    signIn();
    await service.sync();
    expect(server.requests.some((r) => r.startsWith('DELETE'))).toBe(false);
  });
});
