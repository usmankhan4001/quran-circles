import { z } from 'zod';
import { DayOfWeek, LocalDate, LocalTime, Uuid, type Session } from '@qc/contracts';

const Text = z.string().trim().min(1).max(160);
const LocalizedText = z.object({ en: Text, ur: Text.nullable() });

/**
 * The session details a poster is made from. The renderer prints the time and the venue from this
 * (editors cannot type them), returns it with the files, and the API stores it in
 * `posters.source_snapshot`. Comparing it with the session later says whether the poster is out of
 * date (`outOfDate`).
 */
export const SourceSnapshot = z.object({
  sessionId: Uuid,
  /** The session's version when the poster was made: its `updatedAt` or a revision number. */
  sessionVersion: z.string().trim().min(1).max(64),
  localStartTime: LocalTime,
  durationMinutes: z.number().int().min(5).max(600),
  /** 0 is Sunday. Empty for a one-off lecture on `startsOn`. */
  daysOfWeek: z.array(DayOfWeek).max(7),
  startsOn: LocalDate,
  endsOn: LocalDate.nullable(),
  timezone: z.string().trim().min(1).max(64),
  venue: z.object({ id: Uuid, name: LocalizedText, area: LocalizedText.nullable() }),
});
export type SourceSnapshot = z.infer<typeof SourceSnapshot>;

/** Builds the snapshot from the contract's `Session`, plus the area name when the API has it. */
export function snapshotFromSession(
  session: Session,
  sessionVersion: string,
  area: { en: string; ur: string | null } | null = null,
): SourceSnapshot {
  return SourceSnapshot.parse({
    sessionId: session.id,
    sessionVersion,
    localStartTime: session.localStartTime,
    durationMinutes: session.durationMinutes,
    daysOfWeek: session.daysOfWeek,
    startsOn: session.startsOn,
    endsOn: session.endsOn,
    timezone: session.timezone,
    venue: { id: session.venue.id, name: session.venue.name, area },
  });
}

export type OutOfDateReason = 'time' | 'venue';

const sameDays = (a: readonly number[], b: readonly number[]): boolean => {
  const x = [...new Set(a)].sort();
  const y = [...new Set(b)].sort();
  return x.length === y.length && x.every((v, i) => v === y[i]);
};

const sameText = (
  a: { en: string; ur: string | null } | null,
  b: { en: string; ur: string | null } | null,
): boolean => (a === null || b === null ? a === b : a.en === b.en && a.ur === b.ur);

/**
 * Why a poster made from `made` no longer matches the session as it is now (`current`); empty when it
 * still matches. Only what the poster prints counts: the start time, the days (or the date of a
 * one-off lecture) and the venue (place, name or area). A changed duration, end date, title or
 * description does not: the poster does not print them, and editors type their own title.
 */
export function outOfDate(made: SourceSnapshot, current: SourceSnapshot): OutOfDateReason[] {
  if (made.sessionId !== current.sessionId) throw new RangeError('snapshots of different sessions');
  const reasons: OutOfDateReason[] = [];
  // A one-off lecture prints its date; a weekly session prints its days.
  const oneOff = made.daysOfWeek.length === 0 || current.daysOfWeek.length === 0;
  const timeChanged =
    made.localStartTime !== current.localStartTime ||
    !sameDays(made.daysOfWeek, current.daysOfWeek) ||
    made.timezone !== current.timezone ||
    (oneOff && made.startsOn !== current.startsOn);
  if (timeChanged) reasons.push('time');
  const venueChanged =
    made.venue.id !== current.venue.id ||
    !sameText(made.venue.name, current.venue.name) ||
    !sameText(made.venue.area, current.venue.area);
  if (venueChanged) reasons.push('venue');
  return reasons;
}
