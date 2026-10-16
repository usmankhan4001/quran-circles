import { addDays, type CivilDate } from './civil';
import { computeDay, FIVE_PRAYERS, todayAt, type FivePrayer, type PrayerPlace } from './calc';

export interface NextPrayer {
  prayer: FivePrayer;
  at: Date;
  /** Milliseconds from `now` until the prayer. Always positive. */
  msUntil: number;
  /** The calendar day the prayer falls on at the place. */
  date: CivilDate;
  /** True when it is tomorrow's Fajr, because today's prayers have all passed. */
  tomorrow: boolean;
  /** The prayer whose time has started, or null before today's Fajr. */
  current: FivePrayer | null;
}

/**
 * The next prayer and how long until it. After Isha it rolls over to tomorrow's Fajr, and
 * between midnight and Fajr it is still today's Fajr, because the day is the place's calendar
 * day and not the phone's.
 */
export function nextPrayer(place: PrayerPlace, now: Date): NextPrayer {
  const today = todayAt(place, now);
  const day = computeDay(place, today);
  let current: FivePrayer | null = null;
  for (const prayer of FIVE_PRAYERS) {
    const at = day.times[prayer];
    if (at.getTime() > now.getTime()) {
      return {
        prayer,
        at,
        msUntil: at.getTime() - now.getTime(),
        date: today,
        tomorrow: false,
        current,
      };
    }
    current = prayer;
  }
  const tomorrow = addDays(today, 1);
  const at = computeDay(place, tomorrow).times.fajr;
  return {
    prayer: 'fajr',
    at,
    msUntil: at.getTime() - now.getTime(),
    date: tomorrow,
    tomorrow: true,
    current,
  };
}

export interface Countdown {
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
}

/** Splits a wait into hours, minutes and seconds, rounding up so it never shows 0 early. */
export function toCountdown(ms: number): Countdown {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  return {
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    totalSeconds,
  };
}
