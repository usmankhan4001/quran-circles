import { describe, expect, it } from 'vitest';
import { weekOf, monthGrid, shiftMonth } from './calendar';
import { formatClock, clockParts } from './clock';
import {
  addDays,
  civilDateAt,
  compareDays,
  dayOfWeek,
  daysInMonth,
  instantAt,
  minutesOfDayAt,
  sameDay,
} from './civil';
import { nearestCity, PAKISTAN_CITIES, DEFAULT_PLACE } from './places';

describe('civil dates', () => {
  it('adds days across month, year and leap-day boundaries', () => {
    expect(addDays({ year: 2026, month: 12, day: 31 }, 1)).toEqual({
      year: 2027,
      month: 1,
      day: 1,
    });
    expect(addDays({ year: 2028, month: 2, day: 28 }, 1)).toEqual({
      year: 2028,
      month: 2,
      day: 29,
    });
    expect(addDays({ year: 2027, month: 2, day: 28 }, 1)).toEqual({ year: 2027, month: 3, day: 1 });
    expect(addDays({ year: 2026, month: 3, day: 1 }, -1)).toEqual({
      year: 2026,
      month: 2,
      day: 28,
    });
  });

  it('knows the weekday, comparison and month length', () => {
    expect(dayOfWeek({ year: 2026, month: 10, day: 16 })).toBe(5); // Friday
    expect(dayOfWeek({ year: 2026, month: 10, day: 18 })).toBe(0); // Sunday
    expect(sameDay({ year: 2026, month: 1, day: 1 }, { year: 2026, month: 1, day: 1 })).toBe(true);
    expect(
      compareDays({ year: 2026, month: 1, day: 2 }, { year: 2026, month: 1, day: 1 }),
    ).toBeGreaterThan(0);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2027, 2)).toBe(28);
    expect(daysInMonth(2026, 4)).toBe(30);
  });

  it('works out the date and time of day at a place from an instant', () => {
    const instant = new Date('2026-10-16T20:30:00.000Z');
    expect(civilDateAt(instant, 300)).toEqual({ year: 2026, month: 10, day: 17 });
    expect(civilDateAt(instant, 0)).toEqual({ year: 2026, month: 10, day: 16 });
    expect(minutesOfDayAt(instant, 300)).toBe(90);
    expect(minutesOfDayAt(instant, -300)).toBe(15 * 60 + 30);
  });

  it('turns a wall-clock time back into an instant', () => {
    const instant = instantAt({ year: 2026, month: 10, day: 17 }, 90, 300);
    expect(instant.toISOString()).toBe('2026-10-16T20:30:00.000Z');
  });
});

describe('week and month calendar', () => {
  it('lists the Sunday-to-Saturday week that holds a day', () => {
    const week = weekOf({ year: 2026, month: 10, day: 16 }); // a Friday
    expect(week).toHaveLength(7);
    expect(week[0]).toEqual({ year: 2026, month: 10, day: 11 });
    expect(week[6]).toEqual({ year: 2026, month: 10, day: 17 });
    expect(week.map(dayOfWeek)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('starts a week on its own Sunday and crosses a month end', () => {
    expect(weekOf({ year: 2026, month: 11, day: 1 })[0]).toEqual({ year: 2026, month: 11, day: 1 });
    expect(weekOf({ year: 2026, month: 10, day: 31 })[6]).toEqual({
      year: 2026,
      month: 10,
      day: 31,
    });
    expect(weekOf({ year: 2026, month: 12, day: 30 })[6]).toEqual({ year: 2027, month: 1, day: 2 });
  });

  it('lays a month out in rows of seven with padding', () => {
    const grid = monthGrid(2026, 10); // 1 October 2026 is a Thursday
    expect(grid.weeks.every((w) => w.length === 7)).toBe(true);
    expect(grid.weeks[0]?.slice(0, 4)).toEqual([null, null, null, null]);
    expect(grid.weeks[0]?.[4]).toEqual({ year: 2026, month: 10, day: 1 });
    const days = grid.weeks.flat().filter((d) => d !== null);
    expect(days).toHaveLength(31);
    expect(grid.weeks.at(-1)?.at(-1)).toEqual({ year: 2026, month: 10, day: 31 }); // a Saturday
    expect(monthGrid(2026, 11).weeks.at(-1)?.at(-1)).toBeNull();
    expect(grid.weeks).toHaveLength(5);
  });

  it('handles a month that needs six rows and February', () => {
    expect(monthGrid(2026, 8).weeks).toHaveLength(6); // 1 Aug 2026 is a Saturday, 31 days
    expect(monthGrid(2026, 2).weeks.flat().filter(Boolean)).toHaveLength(28);
    expect(monthGrid(2028, 2).weeks.flat().filter(Boolean)).toHaveLength(29);
  });

  it('moves between months across a year end', () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth(2026, 5, 0)).toEqual({ year: 2026, month: 5 });
    expect(shiftMonth(2026, 5, 14)).toEqual({ year: 2027, month: 7 });
  });
});

describe('clock', () => {
  const at = (iso: string) => new Date(iso);
  const labels = { am: 'AM', pm: 'PM' };

  it('shows the wall clock of the place, in 12-hour form', () => {
    // 05:14 in Pakistan is 00:14 UTC.
    expect(clockParts(at('2026-10-16T00:14:00Z'), 300)).toEqual({
      hour: 5,
      minute: 14,
      period: 'am',
    });
    expect(clockParts(at('2026-10-16T13:04:00Z'), 300)).toEqual({
      hour: 6,
      minute: 4,
      period: 'pm',
    });
  });

  it('has no hour 0 on a 12-hour clock', () => {
    expect(clockParts(at('2026-10-16T19:05:00Z'), 300)).toEqual({
      hour: 12,
      minute: 5,
      period: 'am',
    });
    expect(clockParts(at('2026-10-16T07:00:00Z'), 300)).toEqual({
      hour: 12,
      minute: 0,
      period: 'pm',
    });
  });

  it('formats with the labels and pads minutes', () => {
    expect(formatClock(at('2026-10-16T00:14:00Z'), 300, { locale: 'en', labels })).toBe('5:14 AM');
    expect(formatClock(at('2026-10-16T13:04:00Z'), 300, { locale: 'en', labels })).toBe('6:04 PM');
    expect(
      formatClock(at('2026-10-16T13:04:00Z'), 300, {
        locale: 'ur',
        labels: { am: 'صبح', pm: 'شام' },
      }),
    ).toBe('6:04 شام');
  });

  it('supports the 24-hour clock', () => {
    expect(
      formatClock(at('2026-10-16T00:14:00Z'), 300, { locale: 'en', labels, hour12: false }),
    ).toBe('05:14');
    expect(
      formatClock(at('2026-10-16T14:20:00Z'), 300, { locale: 'en', labels, hour12: false }),
    ).toBe('19:20');
  });
});

describe('places', () => {
  it('lists Pakistani cities with sensible coordinates', () => {
    expect(PAKISTAN_CITIES.length).toBeGreaterThanOrEqual(10);
    for (const city of PAKISTAN_CITIES) {
      expect(city.latitude).toBeGreaterThan(23);
      expect(city.latitude).toBeLessThan(37.5);
      expect(city.longitude).toBeGreaterThan(60);
      expect(city.longitude).toBeLessThan(78);
    }
    expect(new Set(PAKISTAN_CITIES.map((c) => c.id)).size).toBe(PAKISTAN_CITIES.length);
    expect(DEFAULT_PLACE.name).toBe('Karachi');
  });

  it('finds the nearest listed city', () => {
    expect(nearestCity(31.4, 74.2).id).toBe('lahore');
    expect(nearestCity(24.9, 67.1).id).toBe('karachi');
    expect(nearestCity(33.7, 73.1).id).toBe('islamabad');
    expect(nearestCity(0, 0).id).toBeDefined();
  });
});
