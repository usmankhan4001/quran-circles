import { CalculationMethod, Coordinates, Madhab, PrayerTimes } from 'adhan';
import { describe, expect, it } from 'vitest';
import { referenceKarachiHanafi } from '../test/praytimesReference';
import { minutesOfDayAt, type CivilDate } from './civil';
import {
  computeDay,
  FIVE_PRAYERS,
  karachiHanafi,
  PAKISTAN_UTC_OFFSET_MINUTES,
  PRAYER_NAMES,
  type PrayerPlace,
} from './calc';
import { PAKISTAN_CITIES } from './places';

const karachi: PrayerPlace = { name: 'Karachi', latitude: 24.8607, longitude: 67.0011 };

const wall = (place: PrayerPlace, date: CivilDate) => {
  const day = computeDay(place, date);
  return Object.fromEntries(
    PRAYER_NAMES.map((name) => [
      name,
      minutesOfDayAt(day.times[name], PAKISTAN_UTC_OFFSET_MINUTES),
    ]),
  ) as Record<(typeof PRAYER_NAMES)[number], number>;
};
const hhmm = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

describe('prayer times, Karachi method with Hanafi Asr', () => {
  it('uses the settings V1 asked the Aladhan service for (method 1, school 1)', () => {
    const params = karachiHanafi();
    expect(params.fajrAngle).toBe(18);
    expect(params.ishaAngle).toBe(18);
    expect(params.madhab).toBe(Madhab.Hanafi);
    expect(params.rounding).toBe('nearest');
  });

  it('leaves out the one minute margin adhan adds to Dhuhr, which Aladhan does not add', () => {
    expect(CalculationMethod.Karachi().methodAdjustments.dhuhr).toBe(1);
    expect(karachiHanafi().methodAdjustments.dhuhr).toBe(0);
  });

  it('gives the pinned times for Karachi on 16 October 2026', () => {
    // Worked out once with `adhan` 4.4.6 and confirmed against the independent reference below
    // (within a minute). It guards against an unnoticed change of library or settings.
    const t = wall(karachi, { year: 2026, month: 10, day: 16 });
    expect(Object.fromEntries(Object.entries(t).map(([k, v]) => [k, hhmm(v)]))).toEqual({
      fajr: '05:14',
      sunrise: '06:30',
      dhuhr: '12:18',
      asr: '16:27',
      maghrib: '18:04',
      isha: '19:20',
    });
  });

  it('gives the pinned times for Lahore on 21 June 2026', () => {
    const lahore = PAKISTAN_CITIES.find((c) => c.id === 'lahore') as PrayerPlace;
    const t = wall(lahore, { year: 2026, month: 6, day: 21 });
    expect(Object.fromEntries(Object.entries(t).map(([k, v]) => [k, hhmm(v)]))).toEqual({
      fajr: '03:19',
      sunrise: '04:58',
      dhuhr: '12:04',
      asr: '17:01',
      maghrib: '19:11',
      isha: '20:50',
    });
  });

  it('orders the day: Fajr, sunrise, Dhuhr, Asr, Maghrib, Isha', () => {
    const day = computeDay(karachi, { year: 2026, month: 3, day: 1 });
    const instants = PRAYER_NAMES.map((n) => day.times[n].getTime());
    expect([...instants].sort((a, b) => a - b)).toEqual(instants);
  });

  it('puts the Hanafi Asr later than the standard (Shafi) Asr', () => {
    expect(FIVE_PRAYERS).toContain('asr');
    const day = computeDay(karachi, { year: 2026, month: 1, day: 15 });
    const standard = CalculationMethod.Karachi();
    standard.madhab = Madhab.Shafi;
    const shafiAsr = new PrayerTimes(
      new Coordinates(karachi.latitude, karachi.longitude),
      new Date(2026, 0, 15),
      standard,
    ).asr;
    const gap = (day.times.asr.getTime() - shafiAsr.getTime()) / 60_000;
    expect(gap).toBeGreaterThan(30);
    expect(gap).toBeLessThan(90);
  });

  it('does not depend on the phone time zone', () => {
    const original = process.env.TZ;
    try {
      const results = ['UTC', 'Asia/Karachi', 'America/Los_Angeles', 'Pacific/Auckland'].map(
        (tz) => {
          process.env.TZ = tz;
          const day = computeDay(karachi, { year: 2026, month: 10, day: 16 });
          return PRAYER_NAMES.map((n) => day.times[n].toISOString());
        },
      );
      for (const r of results) expect(r).toEqual(results[0]);
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });

  it('rounds to whole minutes', () => {
    const day = computeDay(karachi, { year: 2026, month: 5, day: 5 });
    for (const n of PRAYER_NAMES) expect(day.times[n].getTime() % 60_000).toBe(0);
  });

  describe('against the PrayTimes.org reference algorithm (the one Aladhan uses)', () => {
    const places = ['karachi', 'lahore', 'islamabad', 'peshawar', 'quetta', 'gilgit'] as const;
    const dates: CivilDate[] = [
      { year: 2026, month: 1, day: 15 },
      { year: 2026, month: 3, day: 20 },
      { year: 2026, month: 6, day: 21 },
      { year: 2026, month: 9, day: 23 },
      { year: 2026, month: 10, day: 16 },
      { year: 2026, month: 12, day: 21 },
      { year: 2027, month: 2, day: 18 },
    ];

    for (const id of places) {
      for (const date of dates) {
        const label = `${id} ${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
        it(`agrees within one minute: ${label}`, () => {
          const place = PAKISTAN_CITIES.find((c) => c.id === id) as PrayerPlace;
          const ours = wall(place, date);
          const reference = referenceKarachiHanafi(
            place.latitude,
            place.longitude,
            date,
            PAKISTAN_UTC_OFFSET_MINUTES / 60,
          );
          for (const name of PRAYER_NAMES) {
            expect(
              Math.abs(ours[name] - reference[name]),
              `${name}: ours ${hhmm(ours[name])}, reference ${hhmm(reference[name])}`,
            ).toBeLessThanOrEqual(1);
          }
        });
      }
    }
  });

  it('works at the edges of Pakistan', () => {
    for (const [lat, lon] of [
      [23.7, 68.1],
      [37.0, 74.9],
    ] as const) {
      const day = computeDay(
        { name: 'edge', latitude: lat, longitude: lon },
        { year: 2026, month: 6, day: 21 },
      );
      for (const n of PRAYER_NAMES) expect(Number.isNaN(day.times[n].getTime())).toBe(false);
    }
  });
});
