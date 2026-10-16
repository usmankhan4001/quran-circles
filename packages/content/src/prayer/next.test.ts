import { describe, expect, it } from 'vitest';
import { computeDay, type PrayerPlace } from './calc';
import { instantAt } from './civil';
import { nextPrayer, toCountdown } from './next';

const karachi: PrayerPlace = { name: 'Karachi', latitude: 24.8607, longitude: 67.0011 };
const PKT = 300;
const day = { year: 2026, month: 10, day: 16 };
const times = computeDay(karachi, day).times;
const at = (h: number, m: number, d = day) => instantAt(d, h * 60 + m, PKT);

describe('nextPrayer', () => {
  it('is Fajr before dawn, with the wait counted to it', () => {
    const now = at(3, 0);
    const next = nextPrayer(karachi, now);
    expect(next.prayer).toBe('fajr');
    expect(next.tomorrow).toBe(false);
    expect(next.current).toBeNull();
    expect(next.at.getTime()).toBe(times.fajr.getTime());
    expect(next.msUntil).toBe(times.fajr.getTime() - now.getTime());
  });

  it('moves on to Dhuhr after sunrise (sunrise itself is not a prayer)', () => {
    const next = nextPrayer(karachi, at(7, 0));
    expect(next.prayer).toBe('dhuhr');
    expect(next.current).toBe('fajr');
  });

  it('follows the day through Asr, Maghrib and Isha', () => {
    expect(nextPrayer(karachi, at(13, 0)).prayer).toBe('asr');
    expect(nextPrayer(karachi, at(17, 0)).prayer).toBe('maghrib');
    expect(nextPrayer(karachi, at(18, 30)).prayer).toBe('isha');
    expect(nextPrayer(karachi, at(18, 30)).current).toBe('maghrib');
  });

  it('switches at the minute the prayer begins', () => {
    const justBefore = new Date(times.dhuhr.getTime() - 1000);
    expect(nextPrayer(karachi, justBefore).prayer).toBe('dhuhr');
    expect(nextPrayer(karachi, justBefore).msUntil).toBe(1000);
    const exactly = new Date(times.dhuhr.getTime());
    expect(nextPrayer(karachi, exactly).prayer).toBe('asr');
    expect(nextPrayer(karachi, exactly).current).toBe('dhuhr');
  });

  describe('rolling over midnight', () => {
    it("after Isha the next prayer is tomorrow's Fajr", () => {
      const now = at(22, 0);
      const next = nextPrayer(karachi, now);
      const tomorrow = computeDay(karachi, { year: 2026, month: 10, day: 17 }).times.fajr;
      expect(next).toMatchObject({ prayer: 'fajr', tomorrow: true, current: 'isha' });
      expect(next.at.getTime()).toBe(tomorrow.getTime());
      expect(next.date).toEqual({ year: 2026, month: 10, day: 17 });
      expect(next.msUntil).toBe(tomorrow.getTime() - now.getTime());
      expect(next.msUntil).toBeGreaterThan(6 * 3600_000);
    });

    it("just before midnight it is still tomorrow's Fajr", () => {
      const next = nextPrayer(karachi, at(23, 59));
      expect(next).toMatchObject({ prayer: 'fajr', tomorrow: true });
      expect(next.date).toEqual({ year: 2026, month: 10, day: 17 });
    });

    it('just after midnight the day has turned, so it is that day\'s Fajr and not "tomorrow"', () => {
      const now = at(0, 1, { year: 2026, month: 10, day: 17 });
      const next = nextPrayer(karachi, now);
      expect(next).toMatchObject({ prayer: 'fajr', tomorrow: false, current: null });
      expect(next.date).toEqual({ year: 2026, month: 10, day: 17 });
      expect(next.at.getTime()).toBe(
        computeDay(karachi, { year: 2026, month: 10, day: 17 }).times.fajr.getTime(),
      );
    });

    it('the wait shrinks smoothly across midnight, with no jump', () => {
      const before = nextPrayer(karachi, at(23, 59));
      const after = nextPrayer(karachi, at(0, 1, { year: 2026, month: 10, day: 17 }));
      // Two minutes of clock time, and one minute difference in Fajr between the two days.
      const gap = before.msUntil - after.msUntil;
      expect(gap).toBeGreaterThan(110_000);
      expect(gap).toBeLessThan(130_000 + 2 * 60_000);
    });

    it('crosses a month and a year end', () => {
      const newYearsEve = { year: 2026, month: 12, day: 31 };
      const next = nextPrayer(karachi, instantAt(newYearsEve, 22 * 60, PKT));
      expect(next.date).toEqual({ year: 2027, month: 1, day: 1 });
      expect(next.tomorrow).toBe(true);
    });
  });

  it("uses the place's calendar day, not the phone's", () => {
    // 20:30 UTC on 16 October is already 01:30 on the 17th in Pakistan.
    const now = new Date('2026-10-16T20:30:00.000Z');
    const next = nextPrayer(karachi, now);
    expect(next.date).toEqual({ year: 2026, month: 10, day: 17 });
    expect(next.tomorrow).toBe(false);
    expect(next.prayer).toBe('fajr');
  });

  it('honours a different clock offset for the place', () => {
    const dubaiLike: PrayerPlace = { ...karachi, utcOffsetMinutes: 240 };
    const now = new Date('2026-10-16T20:30:00.000Z'); // 00:30 on the 17th at +4
    expect(nextPrayer(dubaiLike, now).date).toEqual({ year: 2026, month: 10, day: 17 });
    const earlier = new Date('2026-10-16T19:30:00.000Z'); // 23:30 on the 16th at +4
    expect(nextPrayer(dubaiLike, earlier).date).toEqual({ year: 2026, month: 10, day: 17 });
    expect(nextPrayer(dubaiLike, earlier).tomorrow).toBe(true);
  });
});

describe('toCountdown', () => {
  it('splits into hours, minutes and seconds', () => {
    expect(toCountdown(((2 * 60 + 5) * 60 + 7) * 1000)).toEqual({
      hours: 2,
      minutes: 5,
      seconds: 7,
      totalSeconds: 7507,
    });
  });

  it('rounds a part second up, so it does not say zero before the time', () => {
    expect(toCountdown(1)).toMatchObject({ seconds: 1, totalSeconds: 1 });
    expect(toCountdown(59_001)).toMatchObject({ minutes: 1, seconds: 0 });
  });

  it('never goes negative', () => {
    expect(toCountdown(-5000)).toEqual({ hours: 0, minutes: 0, seconds: 0, totalSeconds: 0 });
  });
});
