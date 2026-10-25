import type { AuditEntry } from '@qc/contracts';

/**
 * Who an audit row names: the person's name, else the last four digits of their phone (shown
 * masked), else "No name given". Every row is written with a person today; `actorKind: 'system'`
 * is kept for scheduled work if it is ever logged.
 */
export type AuditEntryWithActor = AuditEntry & {
  /** `system` for work no person did (scheduled jobs). Not sent by the API today. */
  actorKind?: 'person' | 'system';
};

export type AuditActor =
  | { kind: 'name'; name: string }
  | { kind: 'phone'; phone: string }
  | { kind: 'system' }
  | { kind: 'unnamed' };

export function auditActor(entry: AuditEntryWithActor): AuditActor {
  const name = entry.actorName?.trim();
  if (name) return { kind: 'name', name };
  if (entry.actorKind === 'system') return { kind: 'system' };
  const phone = entry.actorPhoneLast4?.trim();
  if (phone) return { kind: 'phone', phone };
  return { kind: 'unnamed' };
}
