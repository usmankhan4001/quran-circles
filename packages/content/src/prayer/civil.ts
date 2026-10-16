/**
 * Calendar dates without a clock or a time zone. Prayer times belong to a calendar day at a
 * place, so the code passes that day around as plain numbers and never as a `Date` that the
 * phone's own time zone could shift.
 */
export interface CivilDate {
  year: number;
  /** 1 to 12. */
  month: number;
  /** 1 to 31. */
  day: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_MINUTE = 60 * 1000;

const toUtcDay = (d: CivilDate) => Date.UTC(d.year, d.month - 1, d.day);

export function fromUtcDay(ms: number): CivilDate {
  const date = new Date(ms);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

export function addDays(date: CivilDate, days: number): CivilDate {
  return fromUtcDay(toUtcDay(date) + days * MS_PER_DAY);
}

export function sameDay(a: CivilDate, b: CivilDate): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

export function compareDays(a: CivilDate, b: CivilDate): number {
  return toUtcDay(a) - toUtcDay(b);
}

/** 0 for Sunday to 6 for Saturday. */
export function dayOfWeek(date: CivilDate): number {
  return new Date(toUtcDay(date)).getUTCDay();
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** The calendar day it is at a place whose clock is `utcOffsetMinutes` ahead of UTC. */
export function civilDateAt(instant: Date, utcOffsetMinutes: number): CivilDate {
  return fromUtcDay(instant.getTime() + utcOffsetMinutes * MS_PER_MINUTE);
}

/** Minutes after local midnight, at a place `utcOffsetMinutes` ahead of UTC. */
export function minutesOfDayAt(instant: Date, utcOffsetMinutes: number): number {
  const local = instant.getTime() + utcOffsetMinutes * MS_PER_MINUTE;
  const intoDay = ((local % MS_PER_DAY) + MS_PER_DAY) % MS_PER_DAY;
  return Math.floor(intoDay / MS_PER_MINUTE);
}

/** The instant a place's clock shows `minutes` after midnight on a day. */
export function instantAt(date: CivilDate, minutes: number, utcOffsetMinutes: number): Date {
  return new Date(toUtcDay(date) + (minutes - utcOffsetMinutes) * MS_PER_MINUTE);
}
