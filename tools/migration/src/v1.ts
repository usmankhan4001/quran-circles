import { z } from 'zod';
import { LIMITS } from './constants';

/**
 * The shapes of V1's three tables as the exporters and CSV/JSON files provide them.
 *
 * - `programs` (Supabase): one row per venue. `name` is the area label ("Misrial Road"), `venue`
 *   is the venue name, `contact` is the venue's public number.
 * - `registeration` (Neon, sic): the registration form. `location` is the venue name.
 * - `whatsapp_subscribers` (Neon): `phone`, `venue`, and `name`, which V1's form filled with the
 *   PROGRAM name, not a person's name.
 *
 * V1 accepted inserts from any visitor, so every value is untrusted: control characters are
 * stripped, over-long values are rejected and nothing is trusted to be the type it claims.
 */

/** Control characters (except tab, newline and carriage return, which whitespace collapse handles). */
function stripControls(value: string): string {
  let out = '';
  for (const ch of value) {
    const code = ch.codePointAt(0)!;
    const isControl =
      (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) ||
      (code >= 0x7f && code <= 0x9f) ||
      code === 0x2028 ||
      code === 0x2029;
    out += isControl ? ' ' : ch;
  }
  return out;
}

/** A trimmed single-line string, or null when empty or not text. */
export function toText(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return null;
  const cleaned = stripControls(value).replace(/\s+/g, ' ').trim();
  return cleaned === '' ? null : cleaned;
}

/** A finite number, or null when missing or unparseable. */
export function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

const text = z.unknown().transform(toText);
const limited = (max: number) =>
  text.refine((v) => v === null || v.length <= max, { message: 'too long' });
const requiredId = text.refine((v): v is string => v !== null, { message: 'missing id' });
const number = z.unknown().transform(toNumber);

export const V1VenueRow = z.object({
  id: requiredId,
  created_at: limited(64),
  name: limited(LIMITS.shortText),
  venue: limited(LIMITS.shortText),
  address: limited(LIMITS.address),
  lat: number,
  lng: number,
  contact: limited(64),
});
export type V1Venue = z.infer<typeof V1VenueRow>;

export const V1RegistrationRow = z.object({
  id: requiredId,
  timestamp: limited(64),
  location: limited(LIMITS.shortText),
  read: limited(LIMITS.shortText),
  want: limited(LIMITS.shortText),
  name: limited(LIMITS.name),
  mobile: limited(64),
  age: limited(LIMITS.shortText),
  profession: limited(LIMITS.shortText),
  education: limited(LIMITS.shortText),
  area: limited(LIMITS.shortText),
});
export type V1Registration = z.infer<typeof V1RegistrationRow>;

export const V1SubscriberRow = z.object({
  phone: limited(64),
  venue: limited(LIMITS.shortText),
  name: limited(LIMITS.name),
});
export type V1Subscriber = z.infer<typeof V1SubscriberRow>;

/** Lower-cased, punctuation-free form of a name, for matching only. Never stored or reported. */
export function normaliseForMatch(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Parses an ISO-ish instant. Returns null when it is not a real date. */
export function toInstant(value: string | null): Date | null {
  if (value === null || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
