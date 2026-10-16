/**
 * Time is stored in UTC and shown in the session's timezone (Pakistan time, UTC+5, by default).
 * These helpers turn a local date and time into an instant and back using the platform's
 * time zone data, so a zone with daylight saving would also work.
 */

export const DEFAULT_TIMEZONE = 'Asia/Karachi';

const partsFormatter = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = partsFormatter.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    partsFormatter.set(timeZone, f);
  }
  return f;
}

function localParts(instantMs: number, timeZone: string) {
  const out: Record<string, number> = {};
  for (const p of formatter(timeZone).formatToParts(new Date(instantMs))) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  return out as {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
  };
}

/** Offset of the zone from UTC at an instant, in milliseconds. */
function offsetMs(instantMs: number, timeZone: string): number {
  const p = localParts(instantMs, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instantMs / 1000) * 1000;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** `2027-02-18` and `19:30` in a zone to the UTC instant. */
export function localToUtc(date: string, time: string, timeZone: string): Date {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const [hh, mm] = time.split(':').map(Number) as [number, number];
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const first = offsetMs(guess, timeZone);
  let instant = guess - first;
  const second = offsetMs(instant, timeZone);
  if (second !== first) instant = guess - second;
  return new Date(instant);
}

/** The local calendar date (`YYYY-MM-DD`) of an instant in a zone. */
export function utcToLocalDate(instant: Date, timeZone: string): string {
  const p = localParts(instant.getTime(), timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** The local wall-clock time (`HH:MM`) of an instant in a zone. */
export function utcToLocalTime(instant: Date, timeZone: string): string {
  const p = localParts(instant.getTime(), timeZone);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** 0 is Sunday. */
export function dayOfWeek(date: string): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function compareDates(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Postgres `time` comes back as `HH:MM:SS`; the contract uses `HH:MM`. */
export const toLocalTime = (value: string): string => value.slice(0, 5);

/** A human date and time for a message, in the recipient's language and the session's zone. */
export function formatWhen(instant: Date, timeZone: string, locale: 'en' | 'ur'): string {
  return new Intl.DateTimeFormat(locale === 'ur' ? 'ur-PK' : 'en-GB', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(instant);
}

export const MS_PER_DAY = 24 * 60 * 60 * 1000;
