import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { createResilientStorage, fromAsyncStorage, fromWebStorage, withPrefix } from './adapters';
import { createIndexedDbStorage } from './indexedDb';
import { readJson, writeJson } from './json';
import { createMemoryStorage } from './memory';
import type { KeyValueStorage } from './types';
import { z } from 'zod';

/** What every adapter has to do the same way. */
function behavesLikeStorage(name: string, make: () => KeyValueStorage) {
  describe(name, () => {
    it('returns null for a key that was never set', async () => {
      expect(await make().getItem('missing')).toBeNull();
    });

    it('stores, replaces and removes a value', async () => {
      const storage = make();
      await storage.setItem('k', 'one');
      expect(await storage.getItem('k')).toBe('one');
      await storage.setItem('k', 'two');
      expect(await storage.getItem('k')).toBe('two');
      await storage.removeItem('k');
      expect(await storage.getItem('k')).toBeNull();
    });

    it('keeps keys apart and handles awkward text', async () => {
      const storage = make();
      await storage.setItem('a', 'x');
      await storage.setItem('b', 'تجربہ ✓ "quoted"\n');
      expect(await storage.getItem('a')).toBe('x');
      expect(await storage.getItem('b')).toBe('تجربہ ✓ "quoted"\n');
    });

    it('removing a missing key is not an error', async () => {
      await expect(make().removeItem('nothing')).resolves.toBeUndefined();
    });
  });
}

const webStorageFake = () => {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
};

behavesLikeStorage('memory storage', () => createMemoryStorage());
behavesLikeStorage('web storage adapter', () => fromWebStorage(webStorageFake()));
behavesLikeStorage('AsyncStorage adapter', () => {
  const map = new Map<string, string>();
  return fromAsyncStorage({
    getItem: (k) => Promise.resolve(map.get(k) ?? null),
    setItem: (k, v) => Promise.resolve(void map.set(k, v)),
    removeItem: (k) => Promise.resolve(void map.delete(k)),
  });
});
behavesLikeStorage('IndexedDB adapter', () =>
  createIndexedDbStorage({ factory: new IDBFactory(), databaseName: `test-${Math.random()}` }),
);
behavesLikeStorage('prefixed storage', () => withPrefix(createMemoryStorage(), 'p:'));
behavesLikeStorage('resilient storage', () => createResilientStorage(createMemoryStorage()));

describe('IndexedDB adapter', () => {
  it('keeps data between two openings of the same database', async () => {
    const factory = new IDBFactory();
    await createIndexedDbStorage({ factory, databaseName: 'same' }).setItem('k', 'kept');
    expect(await createIndexedDbStorage({ factory, databaseName: 'same' }).getItem('k')).toBe(
      'kept',
    );
  });

  it('keeps separate databases separate', async () => {
    const factory = new IDBFactory();
    await createIndexedDbStorage({ factory, databaseName: 'one' }).setItem('k', 'x');
    expect(await createIndexedDbStorage({ factory, databaseName: 'two' }).getItem('k')).toBeNull();
  });

  it('rejects when the database cannot be opened', async () => {
    const storage = createIndexedDbStorage({
      factory: {
        open: () => {
          const req = {} as IDBOpenDBRequest;
          queueMicrotask(() => req.onerror?.(new Event('error')));
          return req;
        },
      },
    });
    await expect(storage.getItem('k')).rejects.toBeDefined();
  });
});

describe('prefixed storage', () => {
  it('writes under the prefix', async () => {
    const inner = createMemoryStorage();
    await withPrefix(inner, 'qc:').setItem('k', 'v');
    expect(inner.keys()).toEqual(['qc:k']);
  });
});

describe('resilient storage', () => {
  const broken = (): KeyValueStorage => ({
    getItem: () => Promise.reject(new Error('SecurityError')),
    setItem: () => Promise.reject(new Error('QuotaExceededError')),
    removeItem: () => Promise.reject(new Error('SecurityError')),
  });

  it('never throws, and keeps what it could not save in memory', async () => {
    const storage = createResilientStorage(broken());
    expect(await storage.getItem('k')).toBeNull();
    await storage.setItem('k', 'kept');
    expect(await storage.getItem('k')).toBe('kept');
    await storage.removeItem('k');
    expect(await storage.getItem('k')).toBeNull();
  });

  it('uses the real storage while it works', async () => {
    const inner = createMemoryStorage();
    const storage = createResilientStorage(inner);
    await storage.setItem('k', 'v');
    expect(inner.keys()).toEqual(['k']);
  });
});

describe('readJson and writeJson', () => {
  const schema = z.object({ n: z.number() });

  it('round-trips a valid value', async () => {
    const storage = createMemoryStorage();
    expect(await writeJson(storage, 'k', { n: 1 })).toBe(true);
    expect(await readJson(storage, 'k', schema)).toEqual({ n: 1 });
  });

  it('gives null for missing, malformed or wrongly shaped values', async () => {
    const storage = createMemoryStorage({ bad: '{', wrong: '{"n":"x"}' });
    expect(await readJson(storage, 'none', schema)).toBeNull();
    expect(await readJson(storage, 'bad', schema)).toBeNull();
    expect(await readJson(storage, 'wrong', schema)).toBeNull();
  });

  it('gives null when the storage throws, and false when a write is refused', async () => {
    const storage: KeyValueStorage = {
      getItem: () => Promise.reject(new Error('x')),
      setItem: () => Promise.reject(new Error('x')),
      removeItem: () => Promise.resolve(),
    };
    expect(await readJson(storage, 'k', schema)).toBeNull();
    expect(await writeJson(storage, 'k', { n: 1 })).toBe(false);
  });
});
