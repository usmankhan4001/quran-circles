import type { MessageKey } from './catalogue';

/** The parts of the day an Urdu time names before its figures ("رات 9:00"). */
export const TIME_PERIOD_KEYS = [
  'time.period.lateNight',
  'time.period.morning',
  'time.period.noon',
  'time.period.evening',
  'time.period.night',
] as const satisfies readonly MessageKey[];
export type TimePeriodKey = (typeof TIME_PERIOD_KEYS)[number];

/**
 * The `time.period.*` key for an hour of the local day (0 to 23), with the same bands as the
 * poster renderer's `poster.period.*`: late night 00–03, morning 04–11, noon 12–15, evening
 * 16–18, night 19–23. An hour outside 0–23 is taken modulo 24.
 */
export function timePeriodKey(hour: number): TimePeriodKey {
  const h = ((Math.trunc(hour) % 24) + 24) % 24;
  if (h < 4) return 'time.period.lateNight';
  if (h < 12) return 'time.period.morning';
  if (h < 16) return 'time.period.noon';
  if (h < 19) return 'time.period.evening';
  return 'time.period.night';
}
