/**
 * The one storage shape the content package needs. Apps pass an adapter for what the platform
 * has: AsyncStorage on the phone, localStorage or IndexedDB on the web. Everything is async so
 * the same code runs on all of them.
 */
export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/** The part of `@react-native-async-storage/async-storage` the adapter uses. */
export interface AsyncStorageLike {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<unknown>;
  removeItem(key: string): Promise<unknown>;
}

/** The part of `window.localStorage` the adapter uses. */
export interface WebStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
