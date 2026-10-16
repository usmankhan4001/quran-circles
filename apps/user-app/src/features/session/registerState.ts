import type { Registration, Session } from '@qc/contracts';

/** What the main button of a session says and does, from the session's own state. */
export type RegisterState =
  | { kind: 'cancelled' }
  | { kind: 'notNeeded' }
  | { kind: 'registered'; registration: Registration }
  | { kind: 'waitlist' }
  | { kind: 'open' };

export function registerState(
  session: Session,
  mine: readonly Registration[] | undefined,
): RegisterState {
  if (session.status === 'cancelled') return { kind: 'cancelled' };
  const existing = mine?.find((r) => r.sessionId === session.id && r.status !== 'cancelled');
  if (existing) return { kind: 'registered', registration: existing };
  if (!session.registration.enabled) return { kind: 'notNeeded' };
  if (session.registration.full) return { kind: 'waitlist' };
  return { kind: 'open' };
}
