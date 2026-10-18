import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CreateContentServicesOptions } from '@qc/content/home';
import {
  createIndexedDbStorage,
  createResilientStorage,
  fromAsyncStorage,
} from '@qc/content/storage';
import { Platform } from 'react-native';

type StorageParts = Pick<CreateContentServicesOptions, 'storage' | 'cacheStorage' | 'readV1'>;

/**
 * Where the Quran and prayer package keeps its small state (bookmarks, reading position,
 * settings) and its cached Quran text. Phones use app storage for both. The web build keeps the
 * cached text in IndexedDB, which allows far more than local storage, and offers the one-time
 * import of bookmarks from the old browser app.
 */
export function createContentStorage(): StorageParts {
  const storage = createResilientStorage(fromAsyncStorage(AsyncStorage));
  if (Platform.OS !== 'web' || typeof indexedDB === 'undefined') return { storage };
  return {
    storage,
    cacheStorage: createResilientStorage(createIndexedDbStorage({ factory: indexedDB })),
    readV1: (key) => {
      try {
        return globalThis.localStorage?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
  };
}
