import { messages, timePeriodKey } from '@qc/i18n';
import { isolate } from './ui-tokens';

/**
 * Every date and time the console shows goes through this file (the `I18n` object calls it), so
 * English and Urdu read the same way on every page.
 *
 * - Times and dates are Pakistan time (`Asia/Karachi`), with Latin digits in both languages.
 * - English: "25 Oct 2026", "9:30 pm", "25 Oct 2026, 9:30 pm". No isolation marks.
 * - Urdu: `Intl` in `ur-PK` writes a Latin "PM" and lets the digits run into the Urdu words, so
 *   every run of figures is wrapped in first-strong isolates (U+2068 … U+2069) and the time is
 *   the part of the day and then the figures: "25 اکتوبر، 2026، رات 9:30" with 25, 2026 and
 *   9:30 each isolated. Parts are joined with the Urdu comma "،". Never a narrow no-break space
 *   (U+202F), which the Urdu font cannot draw.
 */

export type DateLocale = 'en' | 'ur';

export const TIME_ZONE = 'Asia/Karachi';

const intlLocale = (locale: DateLocale) => (locale === 'ur' ? 'ur-PK-u-nu-latn' : 'en-GB');

/** The separator between list items and between a date and its time: ", " or "، ". */
export const listSeparator = (locale: DateLocale): string =>
  messages[locale]['console.posters.listSeparator'];

const NUMERIC_PARTS: ReadonlySet<string> = new Set(['day', 'year', 'hour', 'minute']);

function parse(iso: string): Date | null {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "21:30" (or hours and minutes as numbers) as the person reads it. */
export function formatClock(time: string, locale: DateLocale): string {
  const [h = Number.NaN, m = Number.NaN] = time.split(':').map((x) => Number.parseInt(x, 10));
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    return time;
  }
  if (locale === 'ur') {
    const clock = `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')}`;
    return `${messages.ur[timePeriodKey(h)]} ${isolate(clock)}`;
  }
  return new Intl.DateTimeFormat('en-GB', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  })
    .format(new Date(Date.UTC(2023, 0, 1, h, m)))
    .replace(/\u202f/g, ' ');
}

function dateOf(d: Date, locale: DateLocale): string {
  const parts = new Intl.DateTimeFormat(intlLocale(locale), {
    dateStyle: 'medium',
    timeZone: TIME_ZONE,
  }).formatToParts(d);
  return parts
    .map((p) => (locale === 'ur' && NUMERIC_PARTS.has(p.type) ? isolate(p.value) : p.value))
    .join('')
    .replace(/\u202f/g, ' ');
}

/** "HH:MM" of an instant in Pakistan time. */
function pakistanClock(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: TIME_ZONE,
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('hour')}:${get('minute')}`;
}

/** An instant or a `YYYY-MM-DD` day as a date. Anything unreadable is returned unchanged. */
export function formatDate(iso: string, locale: DateLocale): string {
  const d = parse(iso);
  return d ? dateOf(d, locale) : iso;
}

/** An instant as the date and the time in Pakistan. Anything unreadable is returned unchanged. */
export function formatDateTime(iso: string, locale: DateLocale): string {
  const d = parse(iso);
  if (!d) return iso;
  return `${dateOf(d, locale)}${listSeparator(locale)}${formatClock(pakistanClock(d), locale)}`;
}

/** A local day (`YYYY-MM-DD`) and a local time (`HH:MM`), such as a one-off session's start. */
export function formatLocalDateTime(day: string, time: string, locale: DateLocale): string {
  return `${formatDate(day, locale)}${listSeparator(locale)}${formatClock(time, locale)}`;
}

/** The name of a day of the week, 0 being Sunday. */
export function formatWeekday(
  day: number,
  locale: DateLocale,
  style: 'short' | 'long' = 'short',
): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { weekday: style, timeZone: 'UTC' }).format(
    // 2023-01-01 was a Sunday, so day 0 is Sunday.
    new Date(Date.UTC(2023, 0, 1 + day)),
  );
}

/** Several days of the week, in the order given: "Mon, Wed" or "پیر، بدھ". */
export function formatWeekdays(days: readonly number[], locale: DateLocale): string {
  return days.map((d) => formatWeekday(d, locale)).join(listSeparator(locale));
}
