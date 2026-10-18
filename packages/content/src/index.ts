// Public API of @qc/content: the Quran reader, bookmarks and reading position, prayer times and
// the Hijri date. Everything platform-specific (fetch, storage, the signed-in API client) is
// passed in; nothing here reaches the network on its own.
//
// The same API is also split into subpaths, so an app's first screen bundles only what it shows
// (a bundler takes a whole module graph per import): `@qc/content/meta`, `/prayer`, `/storage`,
// `/home` (the services and Home's cards) and `/screens` (the Quran & Prayer tab's screens).
// This entry has all of them.

// Surah, ayah and juz facts (names and counts only: no Quran text lives in this package).
export * from './meta';

// Where the text comes from, and the cache in front of it.
export {
  QuranSourceError,
  isAbortError,
  type FetchOptions,
  type PassageKind,
  type PassageRef,
  type QuranAyah,
  type QuranPassage,
  type QuranSource,
  type QuranSourceErrorCode,
  type QuranVerse,
} from './quran/types';
export {
  ALQURAN_CLOUD_BASE_URL,
  DEFAULT_EDITIONS,
  createAlQuranCloudSource,
  type AlQuranCloudOptions,
} from './quran/alquranCloud';
export {
  CACHE_FRESH_MS,
  CACHE_MAX_PASSAGES,
  createCachedQuranSource,
  type CachedQuranSource,
  type CachedQuranSourceOptions,
} from './quran/cache';
export { passageBismillah, splitBismillah } from './quran/bismillah';
export {
  ARABIC_ZOOM_STEPS,
  DEFAULT_ARABIC_ZOOM_INDEX,
  DEFAULT_READER_PREFS,
  arabicZoom,
  clampZoomIndex,
  createReaderPrefsStore,
  zoomIndexFromV1Rem,
  type ReaderPrefs,
  type ReaderPrefsStore,
} from './quran/prefs';

// Storage adapters.
export * from './storage';

// Bookmarks, reading position and the V1 import.
export type { ContentApi, GetContentApi } from './account/api';
export {
  createBookmarkService,
  type BookmarkEntry,
  type BookmarkInput,
  type BookmarkService,
  type BookmarkServiceOptions,
  type SyncResult,
} from './bookmarks/service';
export {
  IMPORT_MAX_ITEMS,
  V1_KEYS,
  createV1Importer,
  mapV1Bookmarks,
  mapV1LastRead,
  readV1,
  summariseV1,
  type V1ImportOutcome,
  type V1ImportStatus,
  type V1Importer,
  type V1ImporterOptions,
  type V1Reader,
} from './bookmarks/v1Import';
export {
  createReadingPositionService,
  type ReadingPositionOptions,
  type ReadingPositionService,
  type ReadingPositionValue,
} from './reading/position';
export {
  DEFAULT_VIEW_STATE,
  createViewStateStore,
  type CalendarView,
  type Section,
  type ViewState,
  type ViewStateStore,
} from './state/viewState';

// Prayer times and the Hijri date.
export * from './prayer';

// Screens, cards and hooks.
export * from './ui';
