import { addDays, type CivilDate } from './civil';
import { UMALQURA_YEARS } from './umalqura-data';

/** The offset range the admin setting allows (contract: AppConfig.hijriOffsetDays). */
export const HIJRI_OFFSET_MIN = -2;
export const HIJRI_OFFSET_MAX = 2;
export const HIJRI_MONTHS = 12;

export interface HijriDate {
  year: number;
  /** 1 (Muharram) to 12 (Dhu al-Hijjah). */
  month: number;
  day: number;
}

export function clampHijriOffset(offsetDays: number): number {
  if (!Number.isFinite(offsetDays)) return 0;
  return Math.min(Math.max(Math.trunc(offsetDays), HIJRI_OFFSET_MIN), HIJRI_OFFSET_MAX);
}

const MS_PER_DAY = 86_400_000;
const FIRST_YEAR = UMALQURA_YEARS[0];
const LAST_YEAR = UMALQURA_YEARS[UMALQURA_YEARS.length - 1];

const daysSinceEpoch = (d: CivilDate) =>
  Math.round(Date.UTC(d.year, d.month - 1, d.day) / MS_PER_DAY);
const monthLength = (longMonths: number, month: number) =>
  (longMonths >> (month - 1)) & 1 ? 30 : 29;

/**
 * The Hijri date for a calendar day: the Umm al-Qura calendar, moved by the admin's offset.
 *
 * Pakistan starts months by moon sighting, which often falls a day after Saudi Arabia, so the
 * national admin sets how many days to add (-2 to +2). A positive offset moves the Hijri date
 * forward. The calendar is a table of month starts and works the same whatever time zone the
 * phone is in. Returns null for days outside it (1318 to 1500 AH, 1900 to 2077).
 */
export function hijriDate(date: CivilDate, offsetDays = 0): HijriDate | null {
  if (!FIRST_YEAR || !LAST_YEAR) return null;
  const day = daysSinceEpoch(addDays(date, clampHijriOffset(offsetDays)));
  if (day < FIRST_YEAR[1]) return null;

  // The last year that began on or before this day.
  let low = 0;
  let high = UMALQURA_YEARS.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const row = UMALQURA_YEARS[mid];
    if (row && row[1] <= day) low = mid;
    else high = mid - 1;
  }
  const row = UMALQURA_YEARS[low];
  if (!row) return null;

  let remaining = day - row[1];
  for (let month = 1; month <= HIJRI_MONTHS; month++) {
    const length = monthLength(row[2], month);
    if (remaining < length) return { year: row[0], month, day: remaining + 1 };
    remaining -= length;
  }
  // Past the last day of the last year in the table.
  return null;
}
