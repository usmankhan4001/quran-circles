import { E164_PATTERN } from '@qc/contracts';

/**
 * Turns what a person types into an E.164 number. Pakistan (+92) is assumed when there is no
 * country code, as in "0300 1234567", "300 1234567" or "+92 300 1234567". Returns null when
 * the text cannot be a phone number. Eastern Arabic and Urdu digits are accepted.
 */
export function normalizePhone(input: string): string | null {
  const digitsOnly = toWesternDigits(input).replace(/[\s\-().]/g, '');
  if (digitsOnly.length === 0) return null;
  let candidate: string;
  if (digitsOnly.startsWith('+')) candidate = digitsOnly;
  else if (digitsOnly.startsWith('00')) candidate = `+${digitsOnly.slice(2)}`;
  else if (digitsOnly.startsWith('92') && digitsOnly.length >= 12) candidate = `+${digitsOnly}`;
  else if (digitsOnly.startsWith('0')) candidate = `+92${digitsOnly.slice(1)}`;
  else candidate = `+92${digitsOnly}`;
  if (!/^\+[0-9]+$/.test(candidate)) return null;
  if (!E164_PATTERN.test(candidate)) return null;
  // A Pakistani mobile number is +92 3XX XXXXXXX; other lengths are almost always a typo.
  if (candidate.startsWith('+92') && !/^\+923[0-9]{9}$/.test(candidate)) return null;
  return candidate;
}

/** Eastern Arabic (٠-٩) and extended (۰-۹) digits to 0-9. */
export function toWesternDigits(text: string): string {
  return text
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/** The 6 digits of a code, or null. */
export function normalizeCode(input: string): string | null {
  const digits = toWesternDigits(input).replace(/\s/g, '');
  return /^[0-9]{6}$/.test(digits) ? digits : null;
}

/** For display only: "+92 300 0000099" shape. Never logged. */
export function formatPhoneForDisplay(e164: string): string {
  const m = /^\+92(3[0-9]{2})([0-9]{7})$/.exec(e164);
  return m ? `+92 ${m[1]} ${m[2]}` : e164;
}
