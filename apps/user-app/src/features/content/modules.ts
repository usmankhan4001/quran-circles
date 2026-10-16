import type { ComponentType } from 'react';

/**
 * The mount points for the content lane's Quran and prayer modules (`@qc/content`). The app
 * does not import them directly: `loadContentModules` picks them up by name, so this lane
 * builds and tests before the package publishes them, and the Quran & Prayer tab shows a
 * clear "not available yet" state until it does.
 */
export interface ContentModules {
  /** The whole Quran & Prayer tab: reader entry points, bookmarks, prayer times. */
  QuranPrayerScreen?: ComponentType;
  /** Small Home card: the next prayer with a countdown. */
  NextPrayerCard?: ComponentType;
  /** Small Home card: continue reading where the person stopped. */
  ContinueReadingCard?: ComponentType;
}

export const CONTENT_EXPORT_NAMES = [
  'QuranPrayerScreen',
  'NextPrayerCard',
  'ContinueReadingCard',
] as const satisfies readonly (keyof ContentModules)[];

function isComponent(value: unknown): value is ComponentType {
  return typeof value === 'function' || (typeof value === 'object' && value !== null && '$$typeof' in value);
}

/** Picks the known component exports from the `@qc/content` module namespace. */
export function pickContentModules(namespace: Record<string, unknown>): ContentModules {
  const modules: ContentModules = {};
  for (const name of CONTENT_EXPORT_NAMES) {
    const value = namespace[name];
    if (isComponent(value)) modules[name] = value;
  }
  return modules;
}
