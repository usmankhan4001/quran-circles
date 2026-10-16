import { createMemoryStorage } from './memory';
import type { AsyncStorageLike, KeyValueStorage, WebStorageLike } from './types';

/** AsyncStorage on React Native already has the right shape; this narrows it to ours. */
export function fromAsyncStorage(asyncStorage: AsyncStorageLike): KeyValueStorage {
  return {
    getItem: (key) => asyncStorage.getItem(key),
    setItem: async (key, value) => {
      await asyncStorage.setItem(key, value);
    },
    removeItem: async (key) => {
      await asyncStorage.removeItem(key);
    },
  };
}

/** `window.localStorage` (or sessionStorage) behind the async interface. */
export function fromWebStorage(storage: WebStorageLike): KeyValueStorage {
  return {
    getItem: (key) => Promise.resolve(storage.getItem(key)),
    setItem: (key, value) => {
      storage.setItem(key, value);
      return Promise.resolve();
    },
    removeItem: (key) => {
      storage.removeItem(key);
      return Promise.resolve();
    },
  };
}

/**
 * Browsers throw from storage in private windows, when site data is blocked or when the quota
 * is full. This wrapper never throws: a failing read gives null, and after a failing write the
 * value is kept in memory for the rest of the session, so the screen still works.
 */
export function createResilientStorage(primary: KeyValueStorage): KeyValueStorage {
  const fallback = createMemoryStorage();
  const failed = new Set<string>();
  return {
    async getItem(key) {
      if (failed.has(key)) return fallback.getItem(key);
      try {
        return await primary.getItem(key);
      } catch {
        return fallback.getItem(key);
      }
    },
    async setItem(key, value) {
      try {
        await primary.setItem(key, value);
        failed.delete(key);
      } catch {
        failed.add(key);
        await fallback.setItem(key, value);
      }
    },
    async removeItem(key) {
      failed.delete(key);
      await fallback.removeItem(key);
      try {
        await primary.removeItem(key);
      } catch {
        // Nothing left to do: the key is gone from memory, and the browser refused the delete.
      }
    },
  };
}

/** Puts every key under a prefix, so the package never clashes with the app's own keys. */
export function withPrefix(storage: KeyValueStorage, prefix: string): KeyValueStorage {
  return {
    getItem: (key) => storage.getItem(prefix + key),
    setItem: (key, value) => storage.setItem(prefix + key, value),
    removeItem: (key) => storage.removeItem(prefix + key),
  };
}
