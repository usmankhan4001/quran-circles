import type { OccurrenceWithSession, Program, Registration } from '@qc/contracts';
import { useQuery } from '../../data/useQuery';
import { useServices } from '../../providers/services';
import { usePreferences } from '../../providers/hooks';

/** The Instant the API expects: UTC, no milliseconds. */
export function toInstant(date: Date): string {
  return date.toISOString().replace(/\.\d+Z$/, 'Z');
}

/**
 * Picks the session that leads Home: the leading program's first one if there is one, and
 * the soonest of any program otherwise. The list arrives soonest first.
 */
export function pickLeadOccurrence(
  occurrences: readonly OccurrenceWithSession[],
  leading: Program,
): OccurrenceWithSession | undefined {
  return occurrences.find((o) => o.session.program === leading) ?? occurrences[0];
}

/**
 * The next session for a registration, which is what "your next session" shows. A
 * registration for one date uses that date; a recurring one uses the session's next one.
 */
export function nextRegisteredOccurrence(
  registrations: readonly Registration[],
  now: Date,
): { registration: Registration; startsAt: string } | undefined {
  let best: { registration: Registration; startsAt: string } | undefined;
  for (const registration of registrations) {
    if (registration.status !== 'confirmed') continue;
    const next = registration.session.nextOccurrence;
    if (!next || next.status !== 'scheduled') continue;
    if (Date.parse(next.startsAt) < now.getTime()) continue;
    if (registration.occurrenceId && registration.occurrenceId !== next.id) continue;
    if (!best || next.startsAt < best.startsAt) best = { registration, startsAt: next.startsAt };
  }
  return best;
}

/** The next sessions near the person (their city if they chose one), soonest first. */
export function useNextNearYou() {
  const { api, now } = useServices();
  const { cityId } = usePreferences();
  return useQuery(
    `occurrences:next:${cityId ?? 'any'}`,
    async () =>
      (
        await api.occurrences.list({
          query: { from: toInstant(now()), limit: 10, ...(cityId ? { cityId } : {}) },
        })
      ).items,
    { persist: true, staleMs: 60_000 },
  );
}
