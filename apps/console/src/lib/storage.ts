/**
 * Browser storage can be missing or throw (private windows, blocked site data, previews).
 * Every read and write goes through here, and the console works without it.
 */
export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export function webStore(kind: 'local' | 'session'): KeyValueStore {
  const pick = (): Storage | null => {
    try {
      return kind === 'local' ? window.localStorage : window.sessionStorage;
    } catch {
      return null;
    }
  };
  return {
    get(key) {
      try {
        return pick()?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        pick()?.setItem(key, value);
      } catch {
        /* ignore: the console works without storage */
      }
    },
    remove(key) {
      try {
        pick()?.removeItem(key);
      } catch {
        /* ignore */
      }
    },
  };
}

export function memoryStore(initial: Record<string, string> = {}): KeyValueStore {
  const map = new Map(Object.entries(initial));
  return {
    get: (key) => map.get(key) ?? null,
    set: (key, value) => void map.set(key, value),
    remove: (key) => void map.delete(key),
  };
}
