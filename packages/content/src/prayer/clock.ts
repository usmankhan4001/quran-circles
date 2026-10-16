import { formatNumber } from '@qc/ui';
import { minutesOfDayAt } from './civil';

export interface ClockParts {
  /** 1 to 12 for a 12-hour clock, 0 to 23 for a 24-hour clock. */
  hour: number;
  minute: number;
  /** Null on a 24-hour clock. */
  period: 'am' | 'pm' | null;
}

/** The time on the wall clock of a place `utcOffsetMinutes` ahead of UTC. */
export function clockParts(instant: Date, utcOffsetMinutes: number, hour12 = true): ClockParts {
  const minutes = minutesOfDayAt(instant, utcOffsetMinutes);
  const hour24 = Math.floor(minutes / 60);
  const minute = minutes % 60;
  if (!hour12) return { hour: hour24, minute, period: null };
  return { hour: hour24 % 12 === 0 ? 12 : hour24 % 12, minute, period: hour24 < 12 ? 'am' : 'pm' };
}

export interface ClockLabels {
  am: string;
  pm: string;
}

/**
 * "5:14 AM". The digits follow the language's numeral setting in @qc/ui, and the AM and PM
 * words come from the translations. The 24-hour form pads the hour: "05:14".
 */
export function formatClock(
  instant: Date,
  utcOffsetMinutes: number,
  options: { locale: 'en' | 'ur'; labels: ClockLabels; hour12?: boolean },
): string {
  const parts = clockParts(instant, utcOffsetMinutes, options.hour12 ?? true);
  const minute = String(parts.minute).padStart(2, '0');
  if (parts.period === null) {
    return formatNumber(`${String(parts.hour).padStart(2, '0')}:${minute}`, options.locale);
  }
  const time = formatNumber(`${parts.hour}:${minute}`, options.locale);
  return `${time} ${options.labels[parts.period]}`;
}
