import type { Localized } from '@qc/contracts';

/**
 * Client-side search over the rows a page has already loaded. None of the console's admin list
 * endpoints take a free-text query, so the table filters what is on screen; it never asks the
 * server for more. Every word typed must appear somewhere in the row (in English or Urdu), and
 * digits match whatever spacing or script they were typed in, so "0300 12" finds +92300 12…
 */

const EASTERN_DIGITS = /[٠-٩۰-۹]/g;

/** Western digits for Arabic-Indic and Urdu (Extended Arabic-Indic) digits. */
function westernDigits(value: string): string {
  return value.replace(EASTERN_DIGITS, (d) => {
    const code = d.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
}

/** Lower case, compatibility forms folded, Western digits, single spaces. */
export function normalizeForSearch(value: string): string {
  return westernDigits(value.normalize('NFKC')).toLocaleLowerCase().replace(/\s+/g, ' ').trim();
}

/** The words of a query, normalised. An empty query has no words and matches every row. */
export function searchTerms(query: string): string[] {
  const normalized = normalizeForSearch(query);
  return normalized ? normalized.split(' ') : [];
}

export type SearchField = string | number | null | undefined | Localized;

function fieldText(field: SearchField): string[] {
  if (field === null || field === undefined) return [];
  if (typeof field === 'string') return [field];
  if (typeof field === 'number') return [String(field)];
  return [field.en, field.ur ?? ''];
}

/**
 * True when every word of the query appears in one of the fields. A word that is a phone number
 * (digits with spaces, dashes or a plus) also matches the digits of a field, so the way a number
 * was typed does not matter. A leading 0 is read as the national form of +92.
 */
export function matchesSearch(terms: readonly string[], fields: readonly SearchField[]): boolean {
  if (terms.length === 0) return true;
  const texts = fields.flatMap(fieldText).map(normalizeForSearch).filter(Boolean);
  const haystack = texts.join(' \u0000 ');
  const digits = texts.map((t) => t.replace(/\D/g, '')).join(' ');
  return terms.every((term) => {
    if (haystack.includes(term)) return true;
    const termDigits = term.replace(/[\s+\-()]/g, '');
    if (!/^\d{2,}$/.test(termDigits)) return false;
    if (digits.includes(termDigits)) return true;
    return termDigits.startsWith('0') && digits.includes(`92${termDigits.slice(1)}`);
  });
}

/** The rows that match a query; all of them when the query is empty. */
export function filterBySearch<T>(
  rows: readonly T[],
  query: string,
  fieldsOf: (row: T) => readonly SearchField[],
): T[] {
  const terms = searchTerms(query);
  if (terms.length === 0) return [...rows];
  return rows.filter((row) => matchesSearch(terms, fieldsOf(row)));
}
