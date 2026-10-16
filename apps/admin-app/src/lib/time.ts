import type { Locale } from '@qc/contracts';

/**
 * Time in this product is stored in UTC and shown in Pakistan time (UTC+5, no daylight saving).
 * These helpers do the shift by hand so they behave the same on every device.
 */
const PK_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const intlTag = (locale: Locale): string => (locale === 'ur' ? 'ur-PK-u-nu-latn' : 'en-GB');

/** A Date whose UTC fields read as Pakistan wall-clock time. */
function pkShift(instant: string | Date): Date {
  const ms = typeof instant === 'string' ? Date.parse(instant) : instant.getTime();
  return new Date(ms + PK_OFFSET_MS);
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** `2027-02-15` for the Pakistan calendar day an instant falls on. */
export function pkDateOf(instant: string | Date): string {
  const d = pkShift(instant);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** `19:30` for the Pakistan wall-clock time of an instant. */
export function pkTimeOf(instant: string | Date): string {
  const d = pkShift(instant);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** The UTC instants that bound the Pakistan calendar day containing `now`. */
export function pkDayRange(now: Date): { from: string; to: string; date: string } {
  const shifted = pkShift(now);
  const startShifted = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
  );
  const from = new Date(startShifted - PK_OFFSET_MS);
  const to = new Date(startShifted - PK_OFFSET_MS + DAY_MS - 1000);
  const iso = (d: Date) => d.toISOString().replace('.000Z', 'Z');
  return { from: iso(from), to: iso(to), date: pkDateOf(now) };
}

export const isToday = (instant: string, now: Date): boolean => pkDateOf(instant) === pkDateOf(now);

/** A UTC instant for a Pakistan local date and time, such as `2027-02-18` and `19:30`. */
export function pkInstant(localDate: string, localTime: string): string {
  const [h, m] = localTime.split(':').map(Number) as [number, number];
  const d = new Date(`${localDate}T00:00:00Z`);
  d.setUTCMinutes(h * 60 + m - 5 * 60);
  return d.toISOString().replace('.000Z', 'Z');
}

/** `7:30 pm` from a 24-hour `19:30`, in the language's own digits-free form. */
export function formatLocalTime(localTime: string, locale: Locale): string {
  const [h, m] = localTime.split(':').map(Number) as [number, number];
  try {
    return new Intl.DateTimeFormat(intlTag(locale), {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(2000, 0, 1, h, m)));
  } catch {
    const suffix = h >= 12 ? 'pm' : 'am';
    return `${h % 12 === 0 ? 12 : h % 12}:${pad(m)} ${suffix}`;
  }
}

export const formatInstantTime = (instant: string, locale: Locale): string =>
  formatLocalTime(pkTimeOf(instant), locale);

/** `Tue 18 Feb` from a local date `2027-02-18`. */
export function formatLocalDate(localDate: string, locale: Locale): string {
  try {
    return new Intl.DateTimeFormat(intlTag(locale), {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    }).format(new Date(`${localDate}T00:00:00Z`));
  } catch {
    return localDate;
  }
}

export const formatInstantDate = (instant: string, locale: Locale): string =>
  formatLocalDate(pkDateOf(instant), locale);

/** Weekday name for 0 (Sunday) to 6 (Saturday). */
export function weekdayName(
  dow: number,
  locale: Locale,
  style: 'short' | 'long' = 'short',
): string {
  try {
    // 2023-01-01 was a Sunday.
    return new Intl.DateTimeFormat(intlTag(locale), { weekday: style, timeZone: 'UTC' }).format(
      new Date(Date.UTC(2023, 0, 1 + dow)),
    );
  } catch {
    return String(dow);
  }
}

/** True for `HH:MM` on a 24-hour clock. */
export const isLocalTime = (value: string): boolean =>
  /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(value);

/** True for a real calendar date written `YYYY-MM-DD`. */
export function isLocalDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
