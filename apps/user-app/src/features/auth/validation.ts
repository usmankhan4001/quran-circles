import { PersonName } from '@qc/contracts';
import { normalizeCode, normalizePhone } from '../../core/phone';

export type FieldProblem = 'invalid_phone' | 'invalid_code' | 'invalid_name';

export function checkPhone(input: string): { phone: string } | { problem: FieldProblem } {
  const phone = normalizePhone(input);
  return phone ? { phone } : { problem: 'invalid_phone' };
}

export function checkCode(input: string): { code: string } | { problem: FieldProblem } {
  const code = normalizeCode(input);
  return code ? { code } : { problem: 'invalid_code' };
}

export function checkName(input: string): { name: string } | { problem: FieldProblem } {
  const parsed = PersonName.safeParse(input);
  return parsed.success ? { name: parsed.data } : { problem: 'invalid_name' };
}
