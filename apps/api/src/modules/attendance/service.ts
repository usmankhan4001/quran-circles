import { asc, eq, inArray } from 'drizzle-orm';
import type { Attendance } from '../shared/types';
import { schema, type Db } from '../../db';
import { venueScope, writeAudit } from '../shared/audit';
import { invalid } from '../shared/errors';

const { attendance, occurrences, registrations } = schema;

type Reader = Pick<Db, 'select'>;

/**
 * The saved headcount and entries. `markedAt` is the latest time an entry was saved; a headcount
 * saved with no entries falls back to the occurrence's own update time.
 */
export async function readAttendance(db: Reader, occurrenceId: string): Promise<Attendance> {
  const [occurrence] = await db.select().from(occurrences).where(eq(occurrences.id, occurrenceId));
  const entries = await db
    .select()
    .from(attendance)
    .where(eq(attendance.occurrenceId, occurrenceId))
    .orderBy(asc(attendance.markedAt), asc(attendance.id));
  let markedAt: string | null = null;
  if (occurrence?.headcount !== null && occurrence?.headcount !== undefined) {
    const latest = entries.reduce<Date | null>(
      (acc, e) => (acc === null || e.markedAt > acc ? e.markedAt : acc),
      null,
    );
    markedAt = (latest ?? occurrence.updatedAt).toISOString();
  }
  return {
    occurrenceId,
    headcount: occurrence?.headcount ?? null,
    entries: entries.map((e) => ({
      registrationId: e.registrationId,
      name: e.name,
      count: e.count,
    })),
    markedAt,
  };
}

export interface AttendanceInput {
  headcount: number;
  entries: { registrationId: string | null; name: string | null; count: number }[];
}

/** Saves the whole attendance of an occurrence: what is sent replaces what was there. */
export async function saveAttendance(
  db: Db,
  now: Date,
  actorId: string,
  occ: {
    id: string;
    sessionId: string;
    status: 'scheduled' | 'cancelled' | 'done';
    venueId: string;
    cityId: string;
  },
  input: AttendanceInput,
): Promise<Attendance> {
  if (occ.status === 'cancelled') invalid('occurrenceId', 'occurrence_cancelled');

  const registrationIds = input.entries.flatMap((e) =>
    e.registrationId ? [e.registrationId] : [],
  );
  if (new Set(registrationIds).size !== registrationIds.length) {
    invalid('entries', 'duplicate_registration');
  }
  const total = input.entries.reduce((sum, e) => sum + e.count, 0);
  if (total > input.headcount) invalid('headcount', 'below_entries');

  await db.transaction(async (tx) => {
    // Serialise saves for one occurrence so two coordinators cannot interleave their rows.
    await tx
      .select({ id: occurrences.id })
      .from(occurrences)
      .where(eq(occurrences.id, occ.id))
      .for('update');

    if (registrationIds.length) {
      const valid = await tx
        .select({ id: registrations.id })
        .from(registrations)
        .where(inArray(registrations.id, registrationIds));
      const ok = new Set(valid.map((r) => r.id));
      // The registration must belong to this occurrence's session.
      const ofSession = await tx
        .select({ id: registrations.id, sessionId: registrations.sessionId })
        .from(registrations)
        .where(inArray(registrations.id, registrationIds));
      const matching = new Set(
        ofSession.filter((r) => r.sessionId === occ.sessionId).map((r) => r.id),
      );
      input.entries.forEach((e, i) => {
        if (e.registrationId && (!ok.has(e.registrationId) || !matching.has(e.registrationId))) {
          invalid(`entries.${i}.registrationId`);
        }
      });
    }

    await tx.delete(attendance).where(eq(attendance.occurrenceId, occ.id));
    if (input.entries.length) {
      await tx.insert(attendance).values(
        input.entries.map((e) => ({
          occurrenceId: occ.id,
          registrationId: e.registrationId,
          name: e.name,
          count: e.count,
          markedBy: actorId,
          markedAt: now,
        })),
      );
    }
    await tx
      .update(occurrences)
      .set({ headcount: input.headcount, updatedAt: now })
      .where(eq(occurrences.id, occ.id));
    await writeAudit(tx, {
      actorUserId: actorId,
      action: 'attendance.mark',
      entityType: 'occurrence',
      entityId: occ.id,
      scope: venueScope({ id: occ.venueId, cityId: occ.cityId }),
      meta: { headcount: input.headcount, entries: input.entries.length },
    });
  });
  return readAttendance(db, occ.id);
}
