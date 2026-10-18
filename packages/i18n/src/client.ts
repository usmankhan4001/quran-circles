// `@qc/i18n` for an app bundle that downloads one language at a time.
//
// It has the same exports as `index.ts`, but `messages.en` and `messages.ur` start empty and are
// filled in place by `installMessages`, from a table the app loads on demand
// (`@qc/i18n/tables/<app>/<language>`). The user and coordinator apps' web bundlers resolve
// `@qc/i18n` to this file (their `metro.redirects.cjs`), so the kit (`@qc/ui`), `@qc/content`
// and the apps all read the one live catalogue. Type checking and tests still see `index.ts`.
//
// The objects are never replaced, so a module that kept `messages.ur` sees the words arrive. An
// app shows a language only once `hasMessages` says it is in; until then a lookup finds nothing
// and the translators fall back to the other language, or to the key.
import type { messages as catalogue } from './catalogue';

export type { AdminAppKey, ConsoleKey, MessageKey, Part, SharedKey, UserAppKey } from './catalogue';
export { TIME_PERIOD_KEYS, timePeriodKey, type TimePeriodKey } from './time';

type Catalogue = typeof catalogue;
export type Locale = keyof Catalogue;
export type MessageTable = Readonly<Record<string, string>>;

const live: Record<Locale, Record<string, string>> = { en: {}, ur: {} };
const installed = new Set<Locale>();

/** The live catalogue. Typed as the whole catalogue; only installed languages have words. */
export const messages = live as unknown as Catalogue;

/** Adds a language's table to the live catalogue. Installing again adds any new keys. */
export function installMessages(locale: Locale, table: MessageTable): void {
  Object.assign(live[locale], table);
  installed.add(locale);
}

/** True once a table for the language has been installed. */
export function hasMessages(locale: Locale): boolean {
  return installed.has(locale);
}
