import type { SurahInfo } from '../meta/surahs';
import { offsetOf, type PrayerName, type PrayerPlace } from '../prayer/calc';
import type { CivilDate } from '../prayer/civil';
import { dayOfWeek } from '../prayer/civil';
import { formatClock } from '../prayer/clock';
import type { HijriDate } from '../prayer/hijri';
import type { Countdown } from '../prayer/next';
import type { ContentI18n, ContentKey } from './i18n';

export const PRAYER_KEYS: Record<PrayerName, ContentKey> = {
  fajr: 'prayer.fajr',
  sunrise: 'prayer.sunrise',
  dhuhr: 'prayer.dhuhr',
  asr: 'prayer.asr',
  maghrib: 'prayer.maghrib',
  isha: 'prayer.isha',
};

export const WEEKDAY_KEYS: readonly ContentKey[] = [
  'prayer.weekday.0',
  'prayer.weekday.1',
  'prayer.weekday.2',
  'prayer.weekday.3',
  'prayer.weekday.4',
  'prayer.weekday.5',
  'prayer.weekday.6',
];

export const WEEKDAY_SHORT_KEYS: readonly ContentKey[] = [
  'prayer.weekdayShort.0',
  'prayer.weekdayShort.1',
  'prayer.weekdayShort.2',
  'prayer.weekdayShort.3',
  'prayer.weekdayShort.4',
  'prayer.weekdayShort.5',
  'prayer.weekdayShort.6',
];

export const MONTH_KEYS: readonly ContentKey[] = [
  'prayer.month.1',
  'prayer.month.2',
  'prayer.month.3',
  'prayer.month.4',
  'prayer.month.5',
  'prayer.month.6',
  'prayer.month.7',
  'prayer.month.8',
  'prayer.month.9',
  'prayer.month.10',
  'prayer.month.11',
  'prayer.month.12',
];

export const HIJRI_MONTH_KEYS: readonly ContentKey[] = [
  'prayer.hijriMonth.1',
  'prayer.hijriMonth.2',
  'prayer.hijriMonth.3',
  'prayer.hijriMonth.4',
  'prayer.hijriMonth.5',
  'prayer.hijriMonth.6',
  'prayer.hijriMonth.7',
  'prayer.hijriMonth.8',
  'prayer.hijriMonth.9',
  'prayer.hijriMonth.10',
  'prayer.hijriMonth.11',
  'prayer.hijriMonth.12',
];

const LRI = '⁦';
const PDI = '⁩';

/** Keeps a time such as "1 h 20 min" in one left-to-right run inside an Urdu sentence. */
export const isolate = (text: string) => `${LRI}${text}${PDI}`;

export function prayerName(i18n: ContentI18n, prayer: PrayerName): string {
  return i18n.t(PRAYER_KEYS[prayer]);
}

/** "1 h 20 min", "12 min 5 s" or "40 s": the hours show while there are any. */
export function countdownText(i18n: ContentI18n, countdown: Countdown): string {
  const { hours, minutes, seconds } = countdown;
  if (hours > 0) {
    return i18n.t('prayer.countdown.hoursMinutes', {
      hours: i18n.n(hours),
      minutes: i18n.n(minutes),
    });
  }
  if (minutes > 0) {
    return i18n.t('prayer.countdown.minutesSeconds', {
      minutes: i18n.n(minutes),
      seconds: i18n.n(seconds),
    });
  }
  return i18n.t('prayer.countdown.seconds', { seconds: i18n.n(seconds) });
}

/** "Asr in 1 h 20 min". */
export function countdownLine(i18n: ContentI18n, prayer: PrayerName, countdown: Countdown): string {
  return i18n.t('prayer.countdown', {
    prayer: prayerName(i18n, prayer),
    time: isolate(countdownText(i18n, countdown)),
  });
}

export function clockText(i18n: ContentI18n, instant: Date, place: PrayerPlace): string {
  return formatClock(instant, offsetOf(place), {
    locale: i18n.locale,
    labels: { am: i18n.t('prayer.am'), pm: i18n.t('prayer.pm') },
  });
}

export function hijriText(i18n: ContentI18n, date: HijriDate): string {
  return i18n.t('prayer.date.hijri', {
    day: i18n.n(date.day),
    month: i18n.t(HIJRI_MONTH_KEYS[date.month - 1] ?? 'prayer.hijriMonth.1'),
    year: i18n.n(date.year),
  });
}

export function gregorianText(i18n: ContentI18n, date: CivilDate): string {
  return i18n.t('prayer.date.gregorian', {
    weekday: i18n.t(WEEKDAY_KEYS[dayOfWeek(date)] ?? 'prayer.weekday.0'),
    day: i18n.n(date.day),
    month: i18n.t(MONTH_KEYS[date.month - 1] ?? 'prayer.month.1'),
    year: i18n.n(date.year),
  });
}

/**
 * The name of a surah inside a sentence. English shows the transliteration ("Al-Fatihah"). Urdu
 * shows the Arabic-script name, which is how Urdu readers know the surahs.
 */
export function surahName(
  i18n: ContentI18n,
  surah: Pick<SurahInfo, 'nameSimple' | 'nameArabic'>,
): string {
  return i18n.locale === 'ur' ? surah.nameArabic : surah.nameSimple;
}

const CITY_KEYS: Readonly<Record<string, ContentKey>> = {
  karachi: 'prayer.cityName.karachi',
  lahore: 'prayer.cityName.lahore',
  islamabad: 'prayer.cityName.islamabad',
  rawalpindi: 'prayer.cityName.rawalpindi',
  faisalabad: 'prayer.cityName.faisalabad',
  multan: 'prayer.cityName.multan',
  peshawar: 'prayer.cityName.peshawar',
  quetta: 'prayer.cityName.quetta',
  hyderabad: 'prayer.cityName.hyderabad',
  gujranwala: 'prayer.cityName.gujranwala',
  sialkot: 'prayer.cityName.sialkot',
  bahawalpur: 'prayer.cityName.bahawalpur',
  abbottabad: 'prayer.cityName.abbottabad',
  gilgit: 'prayer.cityName.gilgit',
};

/** The city's name in the current language. Falls back to the name the list carries. */
export function cityName(i18n: ContentI18n, city: { id: string; name: string }): string {
  const key = CITY_KEYS[city.id];
  return key ? i18n.t(key) : city.name;
}

const ARABIC_INDIC_ZERO = 0x0660;

/** Digits as printed in the mushaf (Arabic-Indic), for ayah end marks and page numbers. */
export function arabicIndic(value: number): string {
  return String(Math.trunc(value))
    .split('')
    .map((d) => String.fromCharCode(ARABIC_INDIC_ZERO + Number(d)))
    .join('');
}
