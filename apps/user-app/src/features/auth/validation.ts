import {
  ApiClientError,
  PHONE_NOT_PAKISTAN_MOBILE,
  PakistaniMobilePhone,
  PersonName,
  issueCodeOf,
} from '@qc/contracts';
import { normalizeCode, normalizePhone } from '../../core/phone';

export type FieldProblem =
  'invalid_phone' | 'phone_not_pakistan_mobile' | 'invalid_code' | 'invalid_name';

/**
 * A number someone typed, checked the way the server checks it before a code is asked for: a
 * number that cannot be a phone number is `invalid_phone`; a real number that is not a Pakistani
 * mobile (a UK number, say) is `phone_not_pakistan_mobile`, with no round trip (contract
 * `PakistaniMobilePhone`).
 */
export function checkPhone(input: string): { phone: string } | { problem: FieldProblem } {
  const phone = normalizePhone(input);
  if (!phone) return { problem: 'invalid_phone' };
  const parsed = PakistaniMobilePhone.safeParse(phone);
  if (parsed.success) return { phone: parsed.data };
  const notMobile = parsed.error.issues.some((i) => issueCodeOf(i) === PHONE_NOT_PAKISTAN_MOBILE);
  return { problem: notMobile ? 'phone_not_pakistan_mobile' : 'invalid_phone' };
}

/** True when the server refused the number because it is not a Pakistani mobile number. */
export function isNotPakistanMobile(error: unknown): boolean {
  return (
    error instanceof ApiClientError &&
    error.code === 'validation_failed' &&
    (error.issues ?? []).some((i) => i.path === 'phone' && i.code === PHONE_NOT_PAKISTAN_MOBILE)
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
