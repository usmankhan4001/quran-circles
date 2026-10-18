// `@qc/content/prayer`: prayer times and the Hijri date, worked out on the device.
export {
  FIVE_PRAYERS,
  PAKISTAN_UTC_OFFSET_MINUTES,
  PRAYER_NAMES,
  computeDay,
  offsetOf,
  todayAt,
  type DayTimes,
  type FivePrayer,
  type PrayerName,
  type PrayerPlace,
} from './calc';
export { nextPrayer, toCountdown, type Countdown, type NextPrayer } from './next';
export { clockParts, formatClock, type ClockLabels, type ClockParts } from './clock';
export { monthGrid, shiftMonth, weekOf, type MonthGrid } from './calendar';
export { addDays, compareDays, dayOfWeek, daysInMonth, sameDay, type CivilDate } from './civil';
export { DEFAULT_PLACE, PAKISTAN_CITIES, nearestCity } from './places';
export {
  HIJRI_MONTHS,
  HIJRI_OFFSET_MAX,
  HIJRI_OFFSET_MIN,
  clampHijriOffset,
  hijriDate,
  type HijriDate,
} from './hijri';
