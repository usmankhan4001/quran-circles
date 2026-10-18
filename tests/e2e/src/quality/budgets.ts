/**
 * Proposed low-end budgets (docs/quality/low-end-budgets.md). Times are milliseconds on the
 * reference phone, or its emulated stand-in, on Slow 4G; sizes are bytes. The emulation numbers
 * are provisional until the same scenarios run on the phone itself.
 */
export const BUDGETS = {
  /** Cold start (nothing cached): first paint of anything. */
  startFirstPaintMs: 3_000,
  /** Cold start: Home shows its first real content (the next session or the list). */
  startHomeContentMs: 6_000,
  /** Cold start: Home has content and the main thread has settled (no long task for 5 s). */
  startHomeInteractiveMs: 8_000,
  /** Warm start (installed PWA: service worker and cache in place): Home content. */
  warmHomeContentMs: 3_000,
  /** Coordinator app cold start: Today with its actions. */
  adminStartContentMs: 6_000,
  /** Home's tab bar to the Nearby list, first tap after start. */
  firstTapToNearbyMs: 1_500,
  /** Nearby, scrolling a 100-row list: share of dropped frames at 60 Hz. */
  scrollDroppedPct: 10,
  /** Nearby scroll: longest single main-thread task while scrolling. */
  scrollLongestTaskMs: 100,
  /** Nearby: tap "Map" until the map (or its list-only fallback) shows. */
  mapReadyMs: 1_500,
  /** Quran tab: tap a long surah (Al-Baqarah) until its first verse shows, first time. */
  readerFirstVerseMs: 3_000,
  /** Quran reader: the same surah again, from the saved copy. */
  readerReopenMs: 1_000,
  /** Quran reader: total blocking time while the surah renders. */
  readerBlockingMs: 1_000,
  /** JavaScript the first screen needs, gzip, as the production proxy sends it. */
  initialJsGzipBytes: 450 * 1024,
  /** Everything a cold start downloads before Home is interactive (over the air). */
  startTransferBytes: 900 * 1024,
} as const;

export type BudgetKey = keyof typeof BUDGETS;
