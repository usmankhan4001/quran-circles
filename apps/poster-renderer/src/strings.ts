import type { Locale } from '@qc/contracts';
import { messages, type MessageKey } from '@qc/i18n';

export type PosterLocale = Locale;

/**
 * Every key the renderer prints, from `@qc/i18n`. The poster wording lives in the shared catalogue
 * under `poster.*` (contract 1.0.0-rc.5); the Urdu values are drafts under the catalogue's review
 * marker. The rest (`app.name`, `days.*`, `session.schedule`) is shared wording.
 */
export const POSTER_KEYS = [
  'poster.scanToRegister',
  'poster.scanToOpen',
  'poster.dailyAt',
  'poster.onDateAt',
  'poster.listAnd',
  'poster.listComma',
  'poster.period.morning',
  'poster.period.noon',
  'poster.period.evening',
  'poster.period.night',
  'poster.period.lateNight',
  'poster.alt',
] as const satisfies readonly MessageKey[];

const fill = (text: string, vars: Record<string, string>): string =>
  text.replace(/\{(\w+)\}/g, (whole, name: string) => vars[name] ?? whole);

/** A catalogue key (`@qc/i18n`) in one language, filled with `vars`. */
export function t(
  locale: PosterLocale,
  key: MessageKey,
  vars: Record<string, string> = {},
): string {
  const text = (messages[locale] as Record<string, string | undefined>)[key];
  if (text === undefined) throw new RangeError(`missing string ${key} (${locale})`);
  return fill(text, vars);
}
