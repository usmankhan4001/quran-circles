import { CalculationMethod, Coordinates, Madhab, PrayerTimes } from 'adhan';
import type { CivilDate } from './civil';
import { civilDateAt } from './civil';

/** Pakistan Standard Time. Pakistan has no daylight saving now, so a fixed offset is exact. */
export const PAKISTAN_UTC_OFFSET_MINUTES = 5 * 60;

export interface PrayerPlace {
  /** What the person calls it, for display. Not used in the calculation. */
  name: string;
  latitude: number;
  longitude: number;
  /** Minutes the place's clock is ahead of UTC. Defaults to Pakistan Standard Time. */
  utcOffsetMinutes?: number;
}

export const PRAYER_NAMES = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
export type PrayerName = (typeof PRAYER_NAMES)[number];

/** The five daily prayers. Sunrise ends the time of Fajr but is not a prayer. */
export const FIVE_PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
export type FivePrayer = (typeof FIVE_PRAYERS)[number];

export interface DayTimes {
  date: CivilDate;
  times: Record<PrayerName, Date>;
}

export function offsetOf(place: PrayerPlace): number {
  return place.utcOffsetMinutes ?? PAKISTAN_UTC_OFFSET_MINUTES;
}

/**
 * Prayer times for one calendar day at a place, worked out on the device.
 *
 * It is what V1 asked api.aladhan.com for: the University of Islamic Sciences, Karachi method
 * (Fajr and Isha at 18 degrees) with the Hanafi Asr (shadow twice the object's length), now
 * calculated here with the `adhan` library. Times are rounded to the nearest minute.
 * See docs/engineering/decisions/ for the choice of library and how it was checked.
 */
export function computeDay(place: PrayerPlace, date: CivilDate): DayTimes {
  const params = CalculationMethod.Karachi();
  params.madhab = Madhab.Hanafi;
  // adhan reads the year, month and day of the Date it is given and works out absolute
  // instants from them, so the phone's own time zone does not change the result.
  const times = new PrayerTimes(
    new Coordinates(place.latitude, place.longitude),
    new Date(date.year, date.month - 1, date.day),
    params,
  );
  return {
    date,
    times: {
      fajr: times.fajr,
      sunrise: times.sunrise,
      dhuhr: times.dhuhr,
      asr: times.asr,
      maghrib: times.maghrib,
      isha: times.isha,
    },
  };
}

/** The calendar day it is now at the place. */
export function todayAt(place: PrayerPlace, now: Date): CivilDate {
  return civilDateAt(now, offsetOf(place));
}
