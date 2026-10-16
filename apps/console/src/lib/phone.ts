import { E164_PATTERN } from '@qc/contracts';
import type { MessageKey } from '@qc/i18n';

/**
 * Phone numbers are stored and sent as E.164 (`+923001234567`). People type them many ways, so
 * this helper turns Pakistan formats into E.164 and checks anything else against the contract
 * pattern. It never logs or stores the number.
 */
export type PhoneIssue = 'empty' | 'invalid' | 'not_mobile';
export type PhoneKind = 'mobile' | 'landline' | 'international';
export type PhoneResult =
  { ok: true; e164: string; kind: PhoneKind } | { ok: false; issue: PhoneIssue };

export interface PhoneOptions {
  /** Pakistan numbers must be mobile (they receive the WhatsApp code). */
  mobileOnly?: boolean;
}

const EASTERN_ARABIC = /[٠-٩]/g;
const EXTENDED_ARABIC = /[۰-۹]/g;

/** Urdu keyboards type Arabic-Indic digits; turn them into 0-9 before checking. */
export function toAsciiDigits(text: string): string {
  return text
    .replace(EASTERN_ARABIC, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(EXTENDED_ARABIC, (d) => String(d.charCodeAt(0) - 0x06f0));
}

export function normalizePhone(input: string, options: PhoneOptions = {}): PhoneResult {
  const ascii = toAsciiDigits(input).trim();
  if (ascii === '') return { ok: false, issue: 'empty' };
  const compact = ascii.replace(/[\s\-().]/g, '');
  if (!/^\+?[0-9]+$/.test(compact)) return { ok: false, issue: 'invalid' };

  const plus = compact.startsWith('+');
  const digits = plus ? compact.slice(1) : compact;
  let national: string;

  if (plus) {
    if (!digits.startsWith('92')) {
      return E164_PATTERN.test(`+${digits}`)
        ? { ok: true, e164: `+${digits}`, kind: 'international' }
        : { ok: false, issue: 'invalid' };
    }
    national = digits.slice(2);
  } else if (digits.startsWith('0092')) national = digits.slice(4);
  else if (digits.startsWith('92') && digits.length >= 11) national = digits.slice(2);
  else if (digits.startsWith('0')) national = digits.slice(1);
  else national = digits;

  let kind: PhoneKind;
  if (/^3[0-9]{9}$/.test(national)) kind = 'mobile';
  else if (/^[1245-9][0-9]{8,9}$/.test(national)) kind = 'landline';
  else return { ok: false, issue: 'invalid' };

  if (kind === 'landline' && options.mobileOnly) return { ok: false, issue: 'not_mobile' };
  const e164 = `+92${national}`;
  return E164_PATTERN.test(e164) ? { ok: true, e164, kind } : { ok: false, issue: 'invalid' };
}

/** `+923001234567` becomes `+92••••567`: enough to tell two numbers apart, not enough to call. */
export const maskPhone = (e164: string): string => `${e164.slice(0, 3)}••••${e164.slice(-3)}`;

/** The last digits a screen reader can use to tell rows apart, such as `567`. */
export const phoneTail = (e164: string): string => e164.slice(-3);

/** `+923001234567` becomes `+92 300 1234567`. Anything else is returned unchanged. */
export function formatPhone(e164: string): string {
  const m = /^\+92(3[0-9]{2})([0-9]{7})$/.exec(e164);
  return m ? `+92 ${m[1]} ${m[2]}` : e164;
}

/** One literal key per issue, so the compiler checks each message exists in both languages. */
export const PHONE_ISSUE_KEYS = {
  empty: 'console.phone.error.empty',
  invalid: 'console.phone.error.invalid',
  not_mobile: 'console.phone.error.notMobile',
} as const satisfies Record<PhoneIssue, MessageKey>;
