import { createBookmarkService, type BookmarkService } from '../bookmarks/service';
import { createV1Importer, type V1Importer, type V1Reader } from '../bookmarks/v1Import';
import type { GetContentApi } from '../account/api';
import { createAlQuranCloudSource } from '../quran/alquranCloud';
import { createCachedQuranSource, type CachedQuranSource } from '../quran/cache';
import { createReaderPrefsStore, type ReaderPrefsStore } from '../quran/prefs';
import { createReadingPositionService, type ReadingPositionService } from '../reading/position';
import { createViewStateStore, type ViewStateStore } from '../state/viewState';
import { withPrefix } from '../storage/adapters';
import type { KeyValueStorage } from '../storage/types';

/** Everything the screens read from. Built once by the app, or by a test with fakes. */
export interface ContentServices {
  /** The Quran text, cached on the device. */
  source: CachedQuranSource;
  bookmarks: BookmarkService;
  readingPosition: ReadingPositionService;
  prefs: ReaderPrefsStore;
  viewState: ViewStateStore;
  /** Null when there is no V1 browser data to look for (the phone apps). */
  importer: V1Importer | null;
  /** The clock. Tests pass a fake one. */
  now: () => Date;
}

export interface CreateContentServicesOptions {
  /** The platform's fetch. Injected so tests never reach the network. */
  fetch: typeof fetch;
  /** Small state: bookmarks, reading position, reader settings. AsyncStorage, localStorage, ... */
  storage: KeyValueStorage;
  /** Where cached Quran text goes. Defaults to `storage`; the web passes IndexedDB. */
  cacheStorage?: KeyValueStorage;
  /** Returns the API client while signed in, and null while signed out. */
  getApi: GetContentApi;
  /** Reads a V1 browser key. Pass it on the web only. */
  readV1?: V1Reader;
  now?: () => Date;
  baseUrl?: string;
  /**
   * The most Quran passages kept on the device (default 24). Set 0 to read online only, for
   * example if the rights owner does not allow even a cache (decision 0008).
   */
  cacheMaxPassages?: number;
}

export function createContentServices(options: CreateContentServicesOptions): ContentServices {
  const now = options.now ?? (() => new Date());
  const storage = options.storage;
  const source = createCachedQuranSource({
    source: createAlQuranCloudSource({
      fetch: options.fetch,
      now,
      ...(options.baseUrl ? { baseUrl: options.baseUrl } : {}),
    }),
    storage: withPrefix(options.cacheStorage ?? storage, 'qc.quran.cache.'),
    now,
    ...(options.cacheMaxPassages !== undefined ? { maxPassages: options.cacheMaxPassages } : {}),
  });
  const bookmarks = createBookmarkService({ storage, getApi: options.getApi, now });
  const readingPosition = createReadingPositionService({ storage, getApi: options.getApi, now });
  const prefs = createReaderPrefsStore(storage);
  const importer = options.readV1
    ? createV1Importer({
        readV1: options.readV1,
        storage,
        getApi: options.getApi,
        bookmarks,
        readingPosition,
        prefs,
        now,
      })
    : null;
  return {
    source,
    bookmarks,
    readingPosition,
    prefs,
    viewState: createViewStateStore(storage),
    importer,
    now,
  };
}
