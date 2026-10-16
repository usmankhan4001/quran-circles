import type { KeyValueStorage } from './types';

/** Keeps values in memory. Used in tests and as the fallback when real storage is blocked. */
export function createMemoryStorage(initial: Record<string, string> = {}): KeyValueStorage & {
  /** The stored keys, for tests. */
  keys(): string[];
} {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (key) => Promise.resolve(map.get(key) ?? null),
    setItem: (key, value) => {
      map.set(key, value);
      return Promise.resolve();
    },
    removeItem: (key) => {
      map.delete(key);
      return Promise.resolve();
    },
    keys: () => [...map.keys()],
  };
}
