import umalqura from '@umalqura/core';
import type { CivilDate } from './civil';

/** The offset range the admin setting allows (contract: AppConfig.hijriOffsetDays). */
export const HIJRI_OFFSET_MIN = -2;
export const HIJRI_OFFSET_MAX = 2;

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

/**
 * The Hijri date for a calendar day: the Umm al-Qura calendar, moved by the admin's offset.
 * Pakistan starts months by moon sighting, which often falls a day after Saudi Arabia, so the
 * national admin sets how many days to add (-2 to +2). A positive offset moves the Hijri date
 * forward. Returns null for days outside the calendar's range (1318 to 1500 AH).
 */
export function hijriDate(date: CivilDate, offsetDays = 0): HijriDate | null {
  const shifted = new Date(date.year, date.month - 1, date.day + clampHijriOffset(offsetDays));
  // The library reads local calendar fields, so a local date keeps the day we mean.
  try {
    const h = umalqura(shifted);
    return { year: h.hy, month: h.hm, day: h.hd };
  } catch {
    return null;
  }
}

export const HIJRI_MONTHS = 12;
