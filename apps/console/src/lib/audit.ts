import type { AuditEntry } from '@qc/contracts';

/**
 * Who an audit row names.
 *
 * Why the log used to say "System" for people: the API (`listAudit` in
 * apps/api/src/modules/oversight/service.ts) joins `users.display_name` and sends `actorName: null`
 * when the person has no name on their account yet, which is common for coordinators who signed
 * in with a phone code only. Every audit row is written with an actor (`AuditEntryInput.actorUserId`
 * is required), so there are no system rows today; the console read every null as "System".
 *
 * The contract's `AuditEntry` has only `actorName`, so the console cannot show a masked phone or
 * tell a real system action from a person without a name. The two optional fields below are the
 * ones the change request asks the API to add (`actorPhone`, E.164, and `actorKind`); until they
 * arrive, a row with no name says "No name given" rather than "System".
 */
export type AuditEntryWithActor = AuditEntry & {
  /** The actor's number in E.164, shown masked. Not in the contract yet. */
  actorPhone?: string | null;
  /** `system` for work no person did (scheduled jobs). Not in the contract yet. */
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
  const phone = entry.actorPhone?.trim();
  if (phone) return { kind: 'phone', phone };
  return { kind: 'unnamed' };
}
