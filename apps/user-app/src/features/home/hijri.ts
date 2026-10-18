import {
  DEFAULT_PLACE,
  PAKISTAN_UTC_OFFSET_MINUTES,
  hijriDate,
  todayAt,
  type HijriDate,
} from '@qc/content/prayer';
import type { MessageKey } from '../../i18n/translate';

/** The month names, in the keys `@qc/content` already uses for its own Hijri dates. */
export const HIJRI_MONTH_KEYS = [
  'prayer.hijriMonth.1',
  'prayer.hijriMonth.2',
  'prayer.hijriMonth.3',
  'prayer.hijriMonth.4',
  'prayer.hijriMonth.5',
  'prayer.hijriMonth.6',
  'prayer.hijriMonth.7',
  'prayer.hijriMonth.8',
  'prayer.hijriMonth.9',
  'prayer.hijriMonth.10',
  'prayer.hijriMonth.11',
  'prayer.hijriMonth.12',
] as const satisfies readonly MessageKey[];

/** The day in Pakistan, as the content package draws its boundary (Pakistan Standard Time). */
const PAKISTAN = { ...DEFAULT_PLACE, utcOffsetMinutes: PAKISTAN_UTC_OFFSET_MINUTES };

/**
 * Today's Hijri date for the Home header: the calendar day in Pakistan, moved by the admin's
 * `hijriOffsetDays` from `config.get`. Null outside the content package's calendar table.
 */
export function hijriToday(now: Date, offsetDays: number): HijriDate | null {
  return hijriDate(todayAt(PAKISTAN, now), offsetDays);
}
