// Public API of @qc/content: the Quran reader, bookmarks and reading position, prayer times and
// the Hijri date. Apps import from here only. Everything platform-specific (fetch, storage, the
// signed-in API client) is passed in; nothing here reaches the network on its own.

// Surah, ayah and juz facts (names and counts only: no Quran text lives in this package).
export {
  SURAHS,
  SURAH_COUNT,
  JUZ_COUNT,
  TOTAL_AYAHS,
  getSurah,
  ayahCountOf,
  isSurahNumber,
  type SurahInfo,
} from './meta/surahs';
export {
  absoluteAyahNumber,
  clampAyah,
  formatVerseKey,
  isValidAyah,
  nextAyah,
  parseVerseKey,
  type AyahRef,
} from './meta/ayah';
export {
  JUZ_STARTS,
  isJuzNumber,
  juzEnd,
  juzOf,
  juzSegments,
  juzStart,
  type JuzSegment,
} from './meta/juz';
export { searchSurahs, type SurahMatch, type SurahSearchResult } from './meta/search';

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
export type { AsyncStorageLike, KeyValueStorage, WebStorageLike } from './storage/types';
export {
  createResilientStorage,
  fromAsyncStorage,
  fromWebStorage,
  withPrefix,
} from './storage/adapters';
export { createIndexedDbStorage, type IndexedDbStorageOptions } from './storage/indexedDb';
export { createMemoryStorage } from './storage/memory';

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
export {
  FIVE_PRAYERS,
  PAKISTAN_UTC_OFFSET_MINUTES,
  PRAYER_NAMES,
  computeDay,
  offsetOf,
  todayAt,
  type DayTimes,
  type FivePrayer,
  type PrayerName,
  type PrayerPlace,
} from './prayer/calc';
export { nextPrayer, toCountdown, type Countdown, type NextPrayer } from './prayer/next';
export { clockParts, formatClock, type ClockLabels, type ClockParts } from './prayer/clock';
export { monthGrid, shiftMonth, weekOf, type MonthGrid } from './prayer/calendar';
export {
  addDays,
  compareDays,
  dayOfWeek,
  daysInMonth,
  sameDay,
  type CivilDate,
} from './prayer/civil';
export { DEFAULT_PLACE, PAKISTAN_CITIES, nearestCity } from './prayer/places';
export {
  HIJRI_MONTHS,
  HIJRI_OFFSET_MAX,
  HIJRI_OFFSET_MIN,
  clampHijriOffset,
  hijriDate,
  type HijriDate,
} from './prayer/hijri';

// Screens, cards and hooks.
export * from './ui';
