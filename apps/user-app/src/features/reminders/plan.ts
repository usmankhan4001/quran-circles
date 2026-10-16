import type { Occurrence, Registration } from '@qc/contracts';

/** How long before a session's start the on-device reminder fires. Per program in a later wave. */
export const DEFAULT_LEAD_MINUTES = 60;
/** iOS keeps at most 64 pending local notifications for an app. */
export const MAX_SCHEDULED = 50;
export const HORIZON_DAYS = 14;

export interface PlannedReminder {
  /** `<sessionId>:<occurrenceId>`: stable, so a reschedule replaces rather than doubles. */
  id: string;
  sessionId: string;
  occurrenceId: string;
  startsAt: string;
  fireAt: Date;
}

export interface PlanInput {
  registrations: readonly Registration[];
  /** Upcoming occurrences by session id, as the server lists them. */
  occurrences: Readonly<Record<string, readonly Occurrence[]>>;
  /** Session ids the person switched reminders on for. */
  optedIn: ReadonlySet<string>;
  now: Date;
  leadMinutes?: number;
  horizonDays?: number;
  max?: number;
}

/**
 * Works out which on-device reminders to schedule: for every session the person registered
 * for (confirmed, not waitlisted or cancelled) and switched reminders on for, one reminder
 * a fixed time before each upcoming occurrence. A registration for one date gets that date
 * only; a registration for a recurring session gets each coming occurrence.
 */
export function planReminders(input: PlanInput): PlannedReminder[] {
  const lead = (input.leadMinutes ?? DEFAULT_LEAD_MINUTES) * 60_000;
  const horizon = input.now.getTime() + (input.horizonDays ?? HORIZON_DAYS) * 86_400_000;
  const planned = new Map<string, PlannedReminder>();

  for (const registration of input.registrations) {
    if (registration.status !== 'confirmed') continue;
    if (!input.optedIn.has(registration.sessionId)) continue;
    if (registration.session.status !== 'published') continue;
    for (const occurrence of input.occurrences[registration.sessionId] ?? []) {
      if (occurrence.status !== 'scheduled') continue;
      if (registration.occurrenceId && registration.occurrenceId !== occurrence.id) continue;
      const startsAt = Date.parse(occurrence.startsAt);
      const fireAt = new Date(startsAt - lead);
      if (fireAt.getTime() <= input.now.getTime() || startsAt > horizon) continue;
      const id = `${registration.sessionId}:${occurrence.id}`;
      planned.set(id, {
        id,
        sessionId: registration.sessionId,
        occurrenceId: occurrence.id,
        startsAt: occurrence.startsAt,
        fireAt,
      });
    }
  }
  return [...planned.values()]
    .sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime())
    .slice(0, input.max ?? MAX_SCHEDULED);
}
