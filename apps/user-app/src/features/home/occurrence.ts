import type { OccurrenceWithSession, Session } from '@qc/contracts';

/** A session whose "next occurrence" is this specific dated occurrence, for showing on a card. */
export function occurrenceAsSession(item: OccurrenceWithSession): Session {
  const { session: _session, ...occurrence } = item;
  void _session;
  return { ...item.session, nextOccurrence: occurrence };
}
