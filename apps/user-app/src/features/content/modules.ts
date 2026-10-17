import type { ComponentType, ReactNode } from 'react';

/** A place in the Quran: a surah and an ayah in it. */
export interface QuranPlace {
  surah: number;
  ayah: number;
}

/** A place the reader saved as the person's reading position, and when (an ISO instant). */
export interface ReadingMark extends QuranPlace {
  at: string;
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
  /**
   * Home's prayer strip (H4): today's five prayers for the city chosen in the prayer view, the
   * next one marked. Without a city it asks for one.
   */
  PrayerStrip?: ComponentType<{ onPress?: () => void }>;
  /**
   * The words of one ayah for Home's ayah card: the Arabic, and the Urdu translation on an Urdu
   * screen. They come from the same online source and on-device cache as the reader; nothing
   * is drawn while they load or when they cannot be had, so the card keeps just the reference.
   */
  AyahText?: ComponentType<QuranPlace>;
  /**
   * Calls back each time the reader saves the place the person reached (the reading position,
   * on this phone or adopted from the account). Days read use it to count reading in the reader
   * without the person doing anything (feature 1, source `reader`). Returns the unsubscribe.
   */
  subscribeReading?: (listener: (mark: ReadingMark) => void) => () => void;
}
