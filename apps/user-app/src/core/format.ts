import type { Locale } from '@qc/contracts';
import { defaultNumerals } from '@qc/ui';

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

/** "7:30 pm" for an instant, in the session's own time zone (Pakistan time by default). */
export function formatClockTime(
  instant: string,
  timeZone: string,
  locale: Locale,
): string {
  return formatter(locale, timeZone, { hour: 'numeric', minute: '2-digit' }).format(
    new Date(instant),
  );
}

/** "9:00 pm" for a local wall-clock time such as "21:00". */
export function formatLocalTime(hhmm: string, locale: Locale): string {
  const [h = '0', m = '0'] = hhmm.split(':');
  const date = new Date(Date.UTC(2000, 0, 1, Number(h), Number(m)));
  return formatter(locale, 'UTC', { hour: 'numeric', minute: '2-digit' }).format(date);
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
  'days.sunday',
  'days.monday',
  'days.tuesday',
  'days.wednesday',
  'days.thursday',
  'days.friday',
  'days.saturday',
] as const;

/** Formats a count such as a seat number the same way as the kit. */
export function toLocalDigits(value: number, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale), { useGrouping: false }).format(value);
}

/** "Thu, 18 Feb, 9:00 pm" for an instant, in the session's time zone. */
export function formatDateTime(instant: string, timeZone: string, locale: Locale): string {
  return formatter(locale, timeZone, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(instant));
}
