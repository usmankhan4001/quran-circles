import { addDays, dayOfWeek, daysInMonth, type CivilDate } from './civil';

/** The seven days (Sunday first, as V1 showed them) of the week that holds `date`. */
export function weekOf(date: CivilDate): CivilDate[] {
  const start = addDays(date, -dayOfWeek(date));
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export interface MonthGrid {
  year: number;
  month: number;
  /** Rows of seven, Sunday first. Null pads the days before the 1st and after the last. */
  weeks: (CivilDate | null)[][];
}

export function monthGrid(year: number, month: number): MonthGrid {
  const first: CivilDate = { year, month, day: 1 };
  const cells: (CivilDate | null)[] = Array.from({ length: dayOfWeek(first) }, () => null);
  for (let day = 1; day <= daysInMonth(year, month); day++) cells.push({ year, month, day });
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (CivilDate | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return { year, month, weeks };
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}
