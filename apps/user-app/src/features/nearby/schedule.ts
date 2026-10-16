import type { Locale, Occurrence, Session } from '@qc/contracts';
import { formatDateTime, formatLocalDate, formatLocalTime, formatShortDate, DAY_KEYS } from '../../core/format';
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
    .map((d) => t(DAY_KEYS[d] ?? 'days.sunday'))
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
