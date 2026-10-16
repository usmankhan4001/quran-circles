import type { KeyValueStorage } from './types';

/** The small slice of the IndexedDB API used here, so tests can pass a fake factory. */
export interface IDBFactoryLike {
  open(name: string, version?: number): IDBOpenDBRequest;
}

export interface IndexedDbStorageOptions {
  /** `window.indexedDB`. */
  factory: IDBFactoryLike;
  databaseName?: string;
  storeName?: string;
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

/**
 * A key-value store in IndexedDB, for the web build where the cached surahs can outgrow the
 * few megabytes localStorage allows. Values are strings, like the other adapters.
 */
export function createIndexedDbStorage(options: IndexedDbStorageOptions): KeyValueStorage {
  const databaseName = options.databaseName ?? 'qc-content';
  const storeName = options.storeName ?? 'kv';
  let opened: Promise<IDBDatabase> | null = null;

  const open = (): Promise<IDBDatabase> => {
    opened ??= new Promise<IDBDatabase>((resolve, reject) => {
      const req = options.factory.open(databaseName, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(storeName))
          req.result.createObjectStore(storeName);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        opened = null;
        reject(req.error ?? new Error('IndexedDB could not be opened'));
      };
      req.onblocked = () => {
        opened = null;
        reject(new Error('IndexedDB is blocked'));
      };
    });
    return opened;
  };

  const store = async (mode: IDBTransactionMode): Promise<IDBObjectStore> => {
    const db = await open();
    return db.transaction(storeName, mode).objectStore(storeName);
  };

  return {
    async getItem(key) {
      const value = await request((await store('readonly')).get(key));
      return typeof value === 'string' ? value : null;
    },
    async setItem(key, value) {
      await request((await store('readwrite')).put(value, key));
    },
    async removeItem(key) {
      await request((await store('readwrite')).delete(key));
    },
  };
}
