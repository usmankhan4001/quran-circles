import umalqura from '@umalqura/core';
import { describe, expect, it } from 'vitest';
import { addDays } from './civil';
import { clampHijriOffset, hijriDate, HIJRI_OFFSET_MAX, HIJRI_OFFSET_MIN } from './hijri';

describe('hijriDate (Umm al-Qura with the admin offset)', () => {
  // Dates published in the Umm al-Qura calendar.
  it.each([
    [
      { year: 2025, month: 6, day: 26 },
      { year: 1447, month: 1, day: 1 },
    ],
    [
      { year: 2026, month: 2, day: 18 },
      { year: 1447, month: 9, day: 1 },
    ],
    [
      { year: 2026, month: 3, day: 20 },
      { year: 1447, month: 10, day: 1 },
    ],
    [
      { year: 2026, month: 6, day: 16 },
      { year: 1448, month: 1, day: 1 },
    ],
  ])('converts %o to %o with no offset', (gregorian, expected) => {
    expect(hijriDate(gregorian)).toEqual(expected);
  });

  it('is the same with an explicit offset of zero', () => {
    const d = { year: 2026, month: 2, day: 18 };
    expect(hijriDate(d, 0)).toEqual(hijriDate(d));
  });

  describe('offset', () => {
    const base = { year: 2026, month: 2, day: 18 }; // 1 Ramadan 1447 by the calendar

    it('+1 moves the Hijri date a day forward, so Pakistan can be a day behind Saudi Arabia', () => {
      expect(hijriDate(base, 1)).toEqual({ year: 1447, month: 9, day: 2 });
      // The day before 1 Ramadan, with +1, is the calendar's 1 Ramadan.
      expect(hijriDate({ year: 2026, month: 2, day: 17 }, 1)).toEqual({
        year: 1447,
        month: 9,
        day: 1,
      });
    });

    it('-1 moves it a day back', () => {
      expect(hijriDate(base, -1)).toEqual({ year: 1447, month: 8, day: 29 });
    });

    it.each([-2, -1, 0, 1, 2])('applies an offset of %i as that many days', (offset) => {
      const shifted = hijriDate({ year: 2026, month: 5, day: 10 }, offset);
      const reference = hijriDate({ year: 2026, month: 5, day: 10 + offset });
      expect(shifted).toEqual(reference);
    });

    it('rolls over a month and a year end', () => {
      expect(hijriDate({ year: 2025, month: 6, day: 25 }, 2)).toEqual({
        year: 1447,
        month: 1,
        day: 2,
      });
      expect(hijriDate({ year: 2025, month: 6, day: 25 }, -2)).toEqual({
        year: 1446,
        month: 12,
        day: 27,
      });
    });

    it('does not take an offset outside the allowed range', () => {
      expect(clampHijriOffset(5)).toBe(HIJRI_OFFSET_MAX);
      expect(clampHijriOffset(-5)).toBe(HIJRI_OFFSET_MIN);
      expect(clampHijriOffset(1.9)).toBe(1);
      expect(clampHijriOffset(Number.NaN)).toBe(0);
      expect(hijriDate(base, 9)).toEqual(hijriDate(base, 2));
      expect(hijriDate(base, -9)).toEqual(hijriDate(base, -2));
    });
  });

  it('gives the same answer whatever the phone time zone is', () => {
    const original = process.env.TZ;
    try {
      const answers = ['UTC', 'Asia/Karachi', 'America/Los_Angeles', 'Pacific/Auckland'].map(
        (tz) => {
          process.env.TZ = tz;
          return hijriDate({ year: 2026, month: 2, day: 18 }, 1);
        },
      );
      for (const a of answers) expect(a).toEqual(answers[0]);
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });

  it('has a month between 1 and 12 and a day between 1 and 30 all through a year', () => {
    for (let dayOfYear = 0; dayOfYear < 366; dayOfYear++) {
      const h = hijriDate({ year: 2026, month: 1, day: 1 + dayOfYear });
      expect(h).not.toBeNull();
      expect(h?.month).toBeGreaterThanOrEqual(1);
      expect(h?.month).toBeLessThanOrEqual(12);
      expect(h?.day).toBeGreaterThanOrEqual(1);
      expect(h?.day).toBeLessThanOrEqual(30);
    }
  });

  it('matches @umalqura/core on every day from 1900 to 2077', () => {
    // The library reads local dates, so run its conversion for each day as a local date. The
    // table in this package was generated from it, and this keeps the two from drifting.
    const lib = (umalqura as unknown as { default?: typeof umalqura }).default ?? umalqura;
    let day = { year: 1900, month: 4, day: 30 };
    let checked = 0;
    const end = Date.UTC(2077, 10, 16);
    while (Date.UTC(day.year, day.month - 1, day.day) <= end) {
      const h = lib(new Date(day.year, day.month - 1, day.day, 12));
      const ours = hijriDate(day);
      if (ours?.year !== h.hy || ours.month !== h.hm || ours.day !== h.hd) {
        throw new Error(
          `Mismatch on ${JSON.stringify(day)}: ours ${JSON.stringify(ours)}, library ${h.hy}-${h.hm}-${h.hd}`,
        );
      }
      day = addDays(day, 1);
      checked++;
    }
    expect(checked).toBeGreaterThan(64_000);
  });

  it('returns null outside the years the calendar covers', () => {
    expect(hijriDate({ year: 1800, month: 1, day: 1 })).toBeNull();
    expect(hijriDate({ year: 2200, month: 1, day: 1 })).toBeNull();
  });
});
