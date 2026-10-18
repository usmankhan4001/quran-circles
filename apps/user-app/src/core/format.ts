import type { Locale } from '@qc/contracts';
import { messages, timePeriodKey } from '@qc/i18n';
import { defaultNumerals, isolate } from '@qc/ui';

/**
 * Dates and times are formatted here, with the active language, and passed to translations as
 * plain text (docs/engineering/i18n-keys.md). Digits follow the kit's numeral decision.
 */
export function intlLocale(locale: Locale): string {
  const base = locale === 'ur' ? 'ur-PK' : 'en-PK';
  return `${base}-u-nu-${defaultNumerals[locale] === 'eastern-arabic' ? 'arabext' : 'latn'}`;
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(
  locale: Locale,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${locale}|${timeZone}|${JSON.stringify(options)}`;
  let f = formatters.get(key);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat(intlLocale(locale), { timeZone, ...options });
    } catch {
      f = new Intl.DateTimeFormat(intlLocale(locale), { timeZone: 'Asia/Karachi', ...options });
    }
    formatters.set(key, f);
  }
  return f;
}

/** The narrow no-break space newer browsers put before "pm"; the Urdu font has no glyph for it. */
const NARROW_NBSP = /\u202f/g;

/** English times as the browser writes them, with a plain space where it used U+202F. */
function formatEnglish(f: Intl.DateTimeFormat, date: Date): string {
  return f.format(date).replace(NARROW_NBSP, ' ');
}

/**
 * An Urdu time: the part of the day in Urdu, then the figures in 12-hour time with Latin digits
 * ("رات 9:00", A-09). `Intl` in `ur-PK` writes a Latin "PM", so the figures are built here. They
 * are wrapped in an isolate so they stay left to right inside a right-to-left line.
 */
function urduTime(hour: number, minute: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const clock = `${h12}:${String(minute).padStart(2, '0')}`;
  return `${messages.ur[timePeriodKey(hour)]} ${isolate(clock)}`;
}

/** The wall-clock hour (0 to 23) and minute of an instant in a time zone. */
function wallClock(date: Date, timeZone: string): { hour: number; minute: number } {
  const parts = formatter('en', timeZone, {
    hour: 'numeric',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? '0');
  return { hour: value('hour') % 24, minute: value('minute') };
}

/** "7:30 pm" for an instant, in the session's own time zone (Pakistan time by default). */
export function formatClockTime(instant: string, timeZone: string, locale: Locale): string {
  const date = new Date(instant);
  if (locale === 'ur') {
    const { hour, minute } = wallClock(date, timeZone);
    return urduTime(hour, minute);
  }
  return formatEnglish(formatter(locale, timeZone, { hour: 'numeric', minute: '2-digit' }), date);
}

/** "9:00 pm" (Urdu "رات 9:00") for a local wall-clock time such as "21:00". */
export function formatLocalTime(hhmm: string, locale: Locale): string {
  const [h = '0', m = '0'] = hhmm.split(':');
  if (locale === 'ur') return urduTime(Number(h) % 24, Number(m));
  const date = new Date(Date.UTC(2000, 0, 1, Number(h), Number(m)));
  return formatEnglish(formatter(locale, 'UTC', { hour: 'numeric', minute: '2-digit' }), date);
}

/** "Thu, 18 Feb" for an instant, in the session's time zone. */
export function formatShortDate(instant: string, timeZone: string, locale: Locale): string {
  return formatter(locale, timeZone, { weekday: 'short', day: 'numeric', month: 'short' }).format(
    new Date(instant),
  );
}

/** "Thursday, 18 February" for an instant. */
export function formatLongDate(instant: string, timeZone: string, locale: Locale): string {
  return formatter(locale, timeZone, { weekday: 'long', day: 'numeric', month: 'long' }).format(
    new Date(instant),
  );
}

/** "18 Feb 2027" for a local date such as "2027-02-18". */
export function formatLocalDate(date: string, locale: Locale): string {
  const [y = 2000, m = 1, d = 1] = date.split('-').map(Number);
  return formatter(locale, 'UTC', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

/** The weekday number (0 is Sunday) of an instant in a time zone. */
export function weekdayOf(instant: Date | string, timeZone: string): number {
  const name = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(
    typeof instant === 'string' ? new Date(instant) : instant,
  );
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(name);
}

/** Today's date in a time zone, as "2027-02-15". */
export function localDateOf(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
  return parts;
}

export const DAY_KEYS = [
  'days.sun',
  'days.mon',
  'days.tue',
  'days.wed',
  'days.thu',
  'days.fri',
  'days.sat',
] as const;

/** Formats a count such as a seat number the same way as the kit. */
export function toLocalDigits(value: number, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale), { useGrouping: false }).format(value);
}

/**
 * "Thu, 18 Feb, 9:00 pm" for an instant, in the session's time zone. Urdu puts the date first
 * and the time after it in the Urdu way: "پیر، 15 فروری، رات 9:30".
 */
export function formatDateTime(instant: string, timeZone: string, locale: Locale): string {
  const date = new Date(instant);
  if (locale === 'ur') {
    const day = formatter(locale, timeZone, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).format(date);
    const { hour, minute } = wallClock(date, timeZone);
    return `${day}، ${urduTime(hour, minute)}`;
  }
  return formatEnglish(
    formatter(locale, timeZone, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    }),
    date,
  );
}
