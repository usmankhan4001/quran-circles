import type { Locale } from './direction';

export type NumeralSystem = 'western' | 'eastern-arabic';

const EASTERN = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'] as const;

/**
 * Proposal (docs/design/rtl-urdu-guide.md): Urdu screens use Western digits (0-9), because
 * that is what people in Pakistan see in phone numbers, prices, SMS and WhatsApp. Eastern
 * Arabic digits (extended, Urdu form) are available behind this switch, and every number the
 * kit shows goes through `formatNumber`, so changing the decision is a one-line change.
 */
export const defaultNumerals: Record<Locale, NumeralSystem> = {
  en: 'western',
  ur: 'western',
};

export function formatNumber(
  value: number | string,
  locale: Locale = 'en',
  system: NumeralSystem = defaultNumerals[locale],
): string {
  const text = String(value);
  if (system === 'western') return text;
  return text.replace(/[0-9]/g, (d) => EASTERN[Number(d)] ?? d);
}
