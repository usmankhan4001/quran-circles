import { describe, expect, it } from 'vitest';
import { createMemoryStorage } from '../storage/memory';
import { createClock, createFakeQuranApi } from '../test/fakes';
import { createContentServices } from './services';

const make = (cacheMaxPassages?: number) => {
  const api = createFakeQuranApi();
  const storage = createMemoryStorage();
  const services = createContentServices({
    fetch: api.fetch,
    storage,
    getApi: () => null,
    now: createClock().now,
    ...(cacheMaxPassages !== undefined ? { cacheMaxPassages } : {}),
  });
  return { api, storage, services };
};

describe('createContentServices', () => {
  it('keeps a read surah on the device and does not ask the network twice', async () => {
    const { api, services } = make();
    await services.source.getSurah(1);
    await services.source.getSurah(1);
    expect(api.calls).toHaveLength(1);
    expect(await services.source.isCached({ kind: 'surah', id: 1 })).toBe(true);
  });

  it('reads online only when the cache is switched off', async () => {
    const { api, services } = make(0);
    await services.source.getSurah(1);
    await services.source.getSurah(1);
    expect(api.calls).toHaveLength(2);
    expect(await services.source.cachedPassages()).toEqual([]);
  });

  it('puts cached text under its own prefix, apart from the other state', async () => {
    const { storage, services } = make();
    await services.source.getSurah(1);
    await services.bookmarks.toggleAyah({ surah: 1, ayah: 1 });
    const keys = storage.keys();
    expect(keys.some((k) => k.startsWith('qc.quran.cache.'))).toBe(true);
    expect(keys).toContain('qc.bookmarks.v1');
  });

  it('has no V1 importer unless the app can read V1 data', () => {
    expect(make().services.importer).toBeNull();
  });

  it('never calls the network by itself', () => {
    const { api } = make();
    expect(api.calls).toEqual([]);
  });
});
