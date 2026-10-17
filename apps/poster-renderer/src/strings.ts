import { messages, type MessageKey } from '@qc/i18n';

export type PosterLocale = 'en' | 'ur';

/**
 * Poster wording that `@qc/i18n` does not have yet. Change request
 * `docs/engineering/change-requests/2026-10-17-poster-renderer.md` asks for these keys to move into
 * the shared catalogue; until then they live here, English and Urdu together.
 *
 * REVIEW: every Urdu value below is a draft written by Claude. A native Urdu speaker must review
 * them before release (the same marker as `packages/i18n/src/ur.json`).
 */
export const POSTER_STRINGS = {
  'poster.scanToRegister': { en: 'Scan to register', ur: 'رجسٹریشن کے لیے اسکین کریں' },
  'poster.scanToOpen': { en: 'Scan to open in the app', ur: 'ایپ میں کھولنے کے لیے اسکین کریں' },
  'poster.dailyAt': { en: 'Every day at {time}', ur: 'ہر روز {time} بجے' },
  'poster.onDateAt': { en: '{date} at {time}', ur: '{date}، {time} بجے' },
  'poster.listAnd': { en: ' and ', ur: ' اور ' },
  'poster.listComma': { en: ', ', ur: '، ' },
  'poster.period.morning': { en: 'am', ur: 'صبح' },
  'poster.period.noon': { en: 'pm', ur: 'دوپہر' },
  'poster.period.evening': { en: 'pm', ur: 'شام' },
  'poster.period.night': { en: 'pm', ur: 'رات' },
  'poster.period.lateNight': { en: 'am', ur: 'رات' },
  'poster.alt': {
    en: '{title}: Quran circle at {venue}, {when}',
    ur: '{title}: {venue} میں قرآن حلقہ، {when}',
  },
} as const satisfies Record<string, Record<PosterLocale, string>>;
export type PosterStringKey = keyof typeof POSTER_STRINGS;

const fill = (text: string, vars: Record<string, string>): string =>
  text.replace(/\{(\w+)\}/g, (whole, name: string) => vars[name] ?? whole);

/** A shared catalogue key (`@qc/i18n`) or a poster key, filled with `vars`. */
export function t(
  locale: PosterLocale,
  key: MessageKey | PosterStringKey,
  vars: Record<string, string> = {},
): string {
  const poster = (POSTER_STRINGS as Record<string, Record<PosterLocale, string>>)[key];
  const text = poster ? poster[locale] : (messages[locale] as Record<string, string>)[key];
  if (text === undefined) throw new RangeError(`missing string ${key} (${locale})`);
  return fill(text, vars);
}
