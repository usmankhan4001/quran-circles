import { ApiClientError, EmailAddress, PersonName } from '@qc/contracts';
import { normalizeCode, normalizePhone } from '../../core/phone';

export type FieldProblem =
  | 'invalid_email'
  | 'invalid_phone'
  | 'phone_in_use'
  | 'no_account'
  | 'invalid_code'
  | 'invalid_name';

/** An email address as typed: trimmed and lower-cased, or a problem for the field. */
export function checkEmail(input: string): { email: string } | { problem: FieldProblem } {
  const parsed = EmailAddress.safeParse(input);
  return parsed.success ? { email: parsed.data } : { problem: 'invalid_email' };
}

/**
 * The WhatsApp number as typed. Any country is fine with its code ("+44 7700 900123"); without one,
 * Pakistan (+92) is assumed, and a Pakistani number must be a mobile ("0300 1234567"). A code does
 * not verify it: it is for reminders and for coordinators to reach the person.
 */
export function checkWhatsAppNumber(input: string): { phone: string } | { problem: FieldProblem } {
  const phone = normalizePhone(input);
  return phone ? { phone } : { problem: 'invalid_phone' };
}

/** True when the server refused a sign-in with this issue on this field. */
export function hasIssue(error: unknown, path: string, code: string): boolean {
  return (
    error instanceof ApiClientError &&
    error.code === 'validation_failed' &&
    (error.issues ?? []).some((i) => i.path === path && i.code === code)
  );
}

export function checkCode(input: string): { code: string } | { problem: FieldProblem } {
  const code = normalizeCode(input);
  return code ? { code } : { problem: 'invalid_code' };
}

export function checkName(input: string): { name: string } | { problem: FieldProblem } {
  const parsed = PersonName.safeParse(input);
  return parsed.success ? { name: parsed.data } : { problem: 'invalid_name' };
}
