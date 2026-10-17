import type { Locale, Occurrence, Session } from '@qc/contracts';
import {
  formatDateTime,
  formatClockTime,
  formatLocalDate,
  formatLocalTime,
  formatShortDate,
  DAY_KEYS,
} from '../../core/format';
import type { TFunction } from '../../i18n/translate';

/**
 * One plain line about when a session happens: "Every day, 9:00 pm", "Mon, Wed, 7:30 am" or
 * "Thu, 18 Feb, 7:30 pm" for a one-off lecture.
 */
export function describeSchedule(session: Session, t: TFunction, locale: Locale): string {
  const time = formatLocalTime(session.localStartTime, locale);
  if (session.kind === 'one_off' || session.daysOfWeek.length === 0) {
    const first = session.nextOccurrence?.startsAt;
    const date = first
      ? formatShortDate(first, session.timezone, locale)
      : formatLocalDate(session.startsOn, locale);
    return t('session.schedule.oneOff', { date, time });
  }
  if (session.daysOfWeek.length === 7) return t('session.schedule.everyDay', { time });
  const days = [...session.daysOfWeek]
    .sort((a, b) => a - b)
    .map((d) => t(DAY_KEYS[d] ?? 'days.sun'))
    .join(t('schedule.separator'));
  return t('session.schedule.onDays', { days, time });
}

/** "Thu, 18 Feb, 9:00 pm" for one dated occurrence. */
export function describeOccurrence(
  occurrence: Pick<Occurrence, 'startsAt'>,
  timezone: string,
  locale: Locale,
): string {
  return formatDateTime(occurrence.startsAt, timezone, locale);
}

/**
 * The start time and the day, apart, for the big time on a session card: "9:00 pm" and
 * "Thu, 18 Feb". With `next` and a dated occurrence it is that occurrence; otherwise it is the
 * repeating schedule ("Every day", "Mon, Wed").
 */
export function describeWhenParts(
  session: Session,
  t: TFunction,
  locale: Locale,
  next: boolean,
): { time: string; day: string } {
  if (next && session.nextOccurrence) {
    return {
      time: formatClockTime(session.nextOccurrence.startsAt, session.timezone, locale),
      day: formatShortDate(session.nextOccurrence.startsAt, session.timezone, locale),
    };
  }
  const time = formatLocalTime(session.localStartTime, locale);
  if (session.kind === 'one_off' || session.daysOfWeek.length === 0) {
    const first = session.nextOccurrence?.startsAt;
    return {
      time,
      day: first
        ? formatShortDate(first, session.timezone, locale)
        : formatLocalDate(session.startsOn, locale),
    };
  }
  if (session.daysOfWeek.length === 7) return { time, day: t('session.days.everyDay') };
  const days = [...session.daysOfWeek]
    .sort((a, b) => a - b)
    .map((d) => t(DAY_KEYS[d] ?? 'days.sun'))
    .join(t('schedule.separator'));
  return { time, day: days };
}
