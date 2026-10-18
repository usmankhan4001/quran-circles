/** Unicode isolate marks the time formatter wraps an Urdu clock in (`core/format.ts`). */
const ISOLATES = /[⁦-⁩]/g;
/** The figures of a clock: "7:30", "12:05", in Latin or Urdu digits. */
const CLOCK = /[\d۰-۹٠-٩]{1,2}[:٫.][\d۰-۹٠-٩]{2}/;
const LATIN = /^[A-Za-z.\s]+$/;

export interface ClockParts {
  /** The figures, such as "7:30". */
  clock: string;
  /** The part of the day, such as "PM" or "رات". Empty when the time has none. */
  period: string;
  /** The period is read before the figures (as in "رات 9:00"). */
  periodFirst: boolean;
  /** The period is in Latin letters ("PM"), so it is kept to the right of the figures. */
  latinPeriod: boolean;
}

/**
 * Splits a formatted time ("7:30 PM", "رات 9:00") into its figures and the part of the day, so
 * the big start time on Home can show the figures large and the period smaller beside them. At
 * the largest text size "7:30 PM" in one large style is wider than a phone, and "PM" wrapped to a
 * line of its own (A-10). Text that holds no clock comes back whole as `clock`.
 */
export function splitClock(text: string): ClockParts {
  const plain = text.replace(ISOLATES, '').trim();
  const match = CLOCK.exec(plain);
  if (!match) return { clock: plain, period: '', periodFirst: false, latinPeriod: false };
  const before = plain.slice(0, match.index).trim();
  const after = plain.slice(match.index + match[0].length).trim();
  const period = [before, after].filter(Boolean).join(' ');
  return {
    clock: match[0],
    period,
    periodFirst: before !== '' && after === '',
    latinPeriod: period !== '' && LATIN.test(period),
  };
}
