import type { Registration, Session } from '@qc/contracts';

/**
 * What the main button of a session says and does, from the session's own state. There is no seat
 * booking: joining is a pledge to come, so a session with a seat limit still shows Join.
 */
export type RegisterState =
  | { kind: 'cancelled' }
  | { kind: 'notNeeded' }
  | { kind: 'registered'; registration: Registration }
  | { kind: 'open' };

export function registerState(
  session: Session,
  mine: readonly Registration[] | undefined,
): RegisterState {
  if (session.status === 'cancelled') return { kind: 'cancelled' };
  const existing = mine?.find((r) => r.sessionId === session.id && r.status !== 'cancelled');
  if (existing) return { kind: 'registered', registration: existing };
  if (!session.registration.enabled) return { kind: 'notNeeded' };
  return { kind: 'open' };
}
