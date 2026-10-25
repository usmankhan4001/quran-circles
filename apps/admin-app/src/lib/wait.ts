/**
 * How long a refusal asks the person to wait, in words a person reads: seconds under a minute,
 * then minutes, then hours. A wait that is not a whole number of minutes (or hours) is rounded
 * up and said as "about", so nobody is told to come back before the server lets them.
 */
export type WaitUnit = 'seconds' | 'minutes' | 'aboutMinutes' | 'hours' | 'aboutHours';

export interface Wait {
  unit: WaitUnit;
  count: number;
}

/** From this many minutes on, the wait is said in hours. */
const HOURS_FROM_MINUTES = 90;

/** Null when there is no usable wait (missing, zero, negative or not a number). */
export function waitOf(seconds: number | null | undefined): Wait | null {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }
  const whole = Math.ceil(seconds);
  if (whole < 60) return { unit: 'seconds', count: whole };
  const minutes = whole / 60;
  if (Math.ceil(minutes) < HOURS_FROM_MINUTES) {
    return Number.isInteger(minutes)
      ? { unit: 'minutes', count: minutes }
      : { unit: 'aboutMinutes', count: Math.ceil(minutes) };
  }
  const hours = whole / 3600;
  return Number.isInteger(hours)
    ? { unit: 'hours', count: hours }
    : { unit: 'aboutHours', count: Math.ceil(hours) };
}
