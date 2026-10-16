import { Platform } from 'react-native';

/**
 * Where small bits of state live between launches: the sign-in tokens and the person's
 * appearance choices. Reads and writes never throw: a store that fails behaves like an empty one.
 */
export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export function createMemoryStore(initial: Record<string, string> = {}): KeyValueStore {
  const data = new Map<string, string>(Object.entries(initial));
  return {
    get: async (key) => data.get(key) ?? null,
    set: async (key, value) => {
      data.set(key, value);
    },
    remove: async (key) => {
      data.delete(key);
    },
  };
}

interface WebStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function webStorage(kind: 'local' | 'session'): WebStorageLike | null {
  try {
    const g = globalThis as { localStorage?: WebStorageLike; sessionStorage?: WebStorageLike };
    return (kind === 'local' ? g.localStorage : g.sessionStorage) ?? null;
  } catch {
    return null;
  }
}

/**
 * The store for this device. On a phone it is the secure keychain (expo-secure-store). On the
 * web target there is no keychain: `session` keeps values until the tab closes, which suits
 * sign-in tokens; `local` keeps them, which suits appearance choices.
 */
export function createDeviceStore(web: 'local' | 'session' = 'session'): KeyValueStore {
  if (Platform.OS === 'web') {
    const area = webStorage(web);
    return {
      get: async (key) => {
        try {
          return area?.getItem(key) ?? null;
        } catch {
          return null;
        }
      },
      set: async (key, value) => {
        try {
          area?.setItem(key, value);
        } catch {
          /* private mode or full storage: carry on without saving */
        }
      },
      remove: async (key) => {
        try {
          area?.removeItem(key);
        } catch {
          /* nothing to do */
        }
      },
    };
  }
  return {
    get: async (key) => {
      try {
        const SecureStore = await import('expo-secure-store');
        return await SecureStore.getItemAsync(key);
      } catch {
        return null;
      }
    },
    set: async (key, value) => {
      try {
        const SecureStore = await import('expo-secure-store');
        await SecureStore.setItemAsync(key, value);
      } catch {
        /* carry on without saving */
      }
    },
    remove: async (key) => {
      try {
        const SecureStore = await import('expo-secure-store');
        await SecureStore.deleteItemAsync(key);
      } catch {
        /* nothing to do */
      }
    },
  };
}
