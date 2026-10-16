import { messages, type MessageKey } from '@qc/i18n';
import type { Locale } from './direction';

export type UiMessageKey = Extract<MessageKey, `ui.${string}`>;

/**
 * Looks up a built-in string of the kit (close, loading, retry and so on) and fills `{name}`
 * style placeholders. Screens use their own i18n; this is only for words the kit itself shows.
 */
export function t(locale: Locale, key: UiMessageKey, params?: Record<string, string | number>): string {
  const table = messages[locale] as Record<string, string>;
  const fallback = messages.en as Record<string, string>;
  const template = table[key] ?? fallback[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = params[name];
    return value === undefined ? whole : String(value);
  });
}
