import type { MessageKey } from '@qc/i18n';
import { t, type PosterLocale } from './strings';
import type { SourceSnapshot } from './snapshot';

const DAY_KEYS: readonly MessageKey[] = [
  'days.sun',
  'days.mon',
  'days.tue',
  'days.wed',
  'days.thu',
  'days.fri',
  'days.sat',
];

/** "9:30 pm" in English; "رات 9:30" in Urdu. Digits stay Western in both (rtl-urdu-guide). */
export function formatTime(localTime: string, locale: PosterLocale): string {
  const [hh = '0', mm = '00'] = localTime.split(':');
  const h = Number(hh);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const clock = `${h12}:${mm}`;
  if (locale === 'en') return `${clock} ${h < 12 ? 'am' : 'pm'}`;
  const period =
    h < 4
      ? 'poster.period.lateNight'
      : h < 12
        ? 'poster.period.morning'
        : h < 16
          ? 'poster.period.noon'
          : h < 19
            ? 'poster.period.evening'
            : 'poster.period.night';
  return `${t('ur', period)} ${clock}`;
}

function joinList(items: string[], locale: PosterLocale): string {
  if (items.length <= 1) return items.join('');
  const head = items.slice(0, -1).join(t(locale, 'poster.listComma'));
  return `${head}${t(locale, 'poster.listAnd')}${items[items.length - 1]}`;
}

/** A local date (yyyy-mm-dd) as "Saturday 24 October 2026" or "ہفتہ، 24 اکتوبر، 2026". */
export function formatDate(localDate: string, locale: PosterLocale): string {
  const [y, m, d] = localDate.split('-').map(Number);
  const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  const day = t(locale, DAY_KEYS[date.getUTCDay()] ?? 'days.sun');
  const rest = new Intl.DateTimeFormat(locale === 'ur' ? 'ur-PK' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
    numberingSystem: 'latn',
  }).format(date);
  return locale === 'ur' ? `${day}، ${rest}` : `${day} ${rest}`;
}

/**
 * When the session meets, from the snapshot, in one language. Weekly sessions: "Every Friday at
 * 9:30 pm"; a one-off lecture (no days): its date and time.
 */
export function formatWhen(snapshot: SourceSnapshot, locale: PosterLocale): string {
  const time = formatTime(snapshot.localStartTime, locale);
  const days = [...new Set(snapshot.daysOfWeek)].sort((a, b) => a - b);
  if (days.length === 0) {
    return t(locale, 'poster.onDateAt', { date: formatDate(snapshot.startsOn, locale), time });
  }
  if (days.length === 7) return t(locale, 'poster.dailyAt', { time });
  const names = days.map((d) => t(locale, DAY_KEYS[d] ?? 'days.sun'));
  return t(locale, 'session.schedule', { day: joinList(names, locale), time });
}
