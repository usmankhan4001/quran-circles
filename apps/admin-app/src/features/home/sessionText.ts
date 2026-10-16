import type { Locale, Session } from '@qc/contracts';
import type { Translator } from '../../i18n/translate';
import { formatInstantDate, formatInstantTime, formatLocalDate, formatLocalTime, weekdayName } from '../../lib/time';

/** "Every day", "Tue, Thu" or the date of a one-off lecture. */
export function whenSummary(session: Session, t: Translator, locale: Locale): string {
  const time = formatLocalTime(session.localStartTime, locale);
  if (session.kind === 'one_off') return `${formatLocalDate(session.startsOn, locale)} · ${time}`;
  const days = [...session.daysOfWeek].sort((a, b) => a - b);
  const label =
    days.length === 7
      ? t('admin.home.everyDay')
      : days.map((d) => weekdayName(d, locale, 'short')).join(locale === 'ur' ? '، ' : ', ');
  return `${label} · ${time}`;
}

/** The next dated occurrence as "Tue 18 Feb, 7:30 pm", or null when there is none. */
export function nextOccurrenceText(session: Session, locale: Locale): string | null {
  const next = session.nextOccurrence;
  if (!next) return null;
  return `${formatInstantDate(next.startsAt, locale)}, ${formatInstantTime(next.startsAt, locale)}`;
}
