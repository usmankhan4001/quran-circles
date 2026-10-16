import type { ComponentType, ReactNode } from 'react';

/** A place in the Quran: a surah and an ayah in it. */
export interface QuranPlace {
  surah: number;
  ayah: number;
}

/** A request to open the reader. `at` makes a second request for the same place count again. */
export interface ReaderRequest extends QuranPlace {
  at?: number;
}

/**
 * The mount points for the Quran and prayer modules of `@qc/content`. The screens use these and
 * never import the package, so tests can stand in for it and the app still runs (with the Quran
 * tab saying it is not available) if the package is left out.
 */
export interface ContentModules {
  /** Wraps the app so the modules below can find their services. */
  Provider?: ComponentType<{ signedIn: boolean; hijriOffsetDays: number; children: ReactNode }>;
  /** The whole Quran & Prayer tab: the reader, bookmarks and prayer times. */
  QuranPrayerScreen?: ComponentType<{ reader?: ReaderRequest }>;
  /** Small Home card: the next prayer with a countdown. */
  NextPrayerCard?: ComponentType<{ onPress?: () => void }>;
  /** Small Home card: continue reading where the person stopped. */
  ContinueReadingCard?: ComponentType<{ onOpen: (place: QuranPlace) => void }>;
}
