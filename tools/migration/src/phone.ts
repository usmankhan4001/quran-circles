/**
 * Phone number normalisation to E.164, for Pakistani numbers and explicit international ones.
 *
 * V1 stored whatever people typed: `0300 1234567`, `92300...` (its own form strips the plus and
 * swaps a leading 0 for 92), Urdu digits, a stray trunk zero after the country code, and junk.
 * The rules, in order:
 *
 *  - Keep only digits and one optional leading `+`. Spaces, dashes, dots and brackets are
 *    separators. Anything else (letters, `/`, a second number) is rejected.
 *  - Arabic-Indic and Extended Arabic-Indic (Urdu) digits are converted to ASCII digits.
 *  - `+92...` and `0092...` and `92...` are Pakistan. A trunk zero after the country code
 *    (`+92 0300...`) is dropped.
 *  - `03xx...` and `3xx...` are Pakistan national forms.
 *  - A number that is explicitly international (`+` or `00`) with another country code is
 *    accepted when it is 8 to 15 digits. Without the plus it is NOT guessed.
 *  - Pakistan mobile numbers are `3` followed by 0 to 5 and eight more digits. Landlines
 *    (area code plus number, 9 or 10 digits) are accepted only when `allowLandline` is set,
 *    which the tool does for venue contact numbers and never for people.
 */

export type PhoneRejection =
  | 'empty'
  | 'bad_characters'
  | 'too_short'
  | 'too_long'
  | 'not_pakistan_number'
  | 'bad_country_code';

export type PhoneKind = 'mobile' | 'landline' | 'international';

export type PhoneResult =
  { ok: true; e164: string; kind: PhoneKind } | { ok: false; reason: PhoneRejection };

export interface PhoneOptions {
  /** Accept Pakistani landlines. Off by default: registrants and subscribers use WhatsApp. */
  allowLandline?: boolean;
}

const ARABIC_INDIC_ZERO = 0x0660;
const EXTENDED_ARABIC_INDIC_ZERO = 0x06f0;

/** Converts Arabic-Indic (٠-٩) and Extended Arabic-Indic (۰-۹) digits to ASCII. */
function asciiDigits(input: string): string {
  let out = '';
  for (const ch of input) {
    const code = ch.codePointAt(0)!;
    if (code >= ARABIC_INDIC_ZERO && code <= ARABIC_INDIC_ZERO + 9) {
      out += String(code - ARABIC_INDIC_ZERO);
    } else if (code >= EXTENDED_ARABIC_INDIC_ZERO && code <= EXTENDED_ARABIC_INDIC_ZERO + 9) {
      out += String(code - EXTENDED_ARABIC_INDIC_ZERO);
    } else {
      out += ch;
    }
  }
  return out;
}

// Zero-width and bidi control characters, byte order mark, no-break and other unusual spaces.
const INVISIBLE = /[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff\u00a0\u2007\u202f]/g;
const SEPARATORS = /[\s\-.()]/g;

const MOBILE = /^3[0-5]\d{8}$/;
const LANDLINE = /^[2-9]\d{8,9}$/;

const dropTrunkZero = (national: string) =>
  national.startsWith('0') ? national.slice(1) : national;

function classifyPakistan(national: string, opts: PhoneOptions): PhoneResult {
  if (MOBILE.test(national)) return { ok: true, e164: `+92${national}`, kind: 'mobile' };
  if (opts.allowLandline && !national.startsWith('3') && LANDLINE.test(national)) {
    return { ok: true, e164: `+92${national}`, kind: 'landline' };
  }
  const fullLength = national.startsWith('3') ? 10 : 9;
  if (national.length < fullLength) return { ok: false, reason: 'too_short' };
  if (national.length > 10) return { ok: false, reason: 'too_long' };
  return { ok: false, reason: 'not_pakistan_number' };
}

/** Normalises one raw value. Never throws; returns the reason when the value is not usable. */
export function normalisePhone(raw: unknown, opts: PhoneOptions = {}): PhoneResult {
  if (typeof raw !== 'string' && typeof raw !== 'number') return { ok: false, reason: 'empty' };
  let text = asciiDigits(String(raw)).replace(INVISIBLE, '').trim();
  if (text === '') return { ok: false, reason: 'empty' };

  text = text.replace(SEPARATORS, '');
  if (text === '' || text === '+') return { ok: false, reason: 'empty' };
  if (!/^\+?\d+$/.test(text)) return { ok: false, reason: 'bad_characters' };

  const hasPlus = text.startsWith('+');
  let digits = hasPlus ? text.slice(1) : text;
  if (digits === '') return { ok: false, reason: 'empty' };

  let explicit = hasPlus;
  if (digits.startsWith('00')) {
    // `+0092...` is not a thing; `0092...` is the international dialling prefix.
    if (hasPlus) return { ok: false, reason: 'bad_country_code' };
    digits = digits.slice(2);
    explicit = true;
  }

  if (explicit) {
    if (digits === '' || digits.startsWith('0')) return { ok: false, reason: 'bad_country_code' };
    if (digits.startsWith('92')) return classifyPakistan(dropTrunkZero(digits.slice(2)), opts);
    if (digits.length < 8) return { ok: false, reason: 'too_short' };
    if (digits.length > 15) return { ok: false, reason: 'too_long' };
    return { ok: true, e164: `+${digits}`, kind: 'international' };
  }

  // No plus and no 00: only Pakistani shapes are recognised.
  if (digits.startsWith('92')) return classifyPakistan(dropTrunkZero(digits.slice(2)), opts);
  if (digits.startsWith('0')) return classifyPakistan(digits.slice(1), opts);
  return classifyPakistan(digits, opts);
}

/** Shorthand: the E.164 string or null. */
export function toE164(raw: unknown, opts: PhoneOptions = {}): string | null {
  const result = normalisePhone(raw, opts);
  return result.ok ? result.e164 : null;
}
