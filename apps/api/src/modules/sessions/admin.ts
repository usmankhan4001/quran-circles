import { and, asc, desc, eq, gte, lte, ne, or, inArray, sql, type SQL } from 'drizzle-orm';
import {
  type AdminOccurrence,
  type AdminSession,
  type ScopeFilter,
  type SessionCreate,
} from '@qc/contracts';
import type { Portion as PortionValue } from '@qc/contracts';
import type { ScheduleChangeResponse } from '../shared/types';
import { schema, type Db } from '../../db';
import { venueScope, writeAudit } from '../shared/audit';
import { fail, invalid, isUniqueViolation } from '../shared/errors';
import { decodeOffsetCursor, offsetPage, type Page } from '../shared/pagination';
import type { PublishDeps } from '../updates/publish';
import { nextStart, publishSessionEvent, sessionFacts } from '../updates/publish';
import { promoteWaitlist } from '../registrations/waitlist';
import {
  applyScheduleChange,
  cancelFutureOccurrences,
  materializeSession,
  type ScheduleSpec,
} from './occurrences';
import { specOf } from './public';
import { loadSessions, selectSessionRecords, toAdminOccurrence, toPublicSession } from './views';
import { compareDates } from '../shared/time';

const { sessions, venues, programs, seasons, circles, occurrences, cities } = schema;

export interface AdminDeps extends PublishDeps {
  horizonDays: number;
}

export async function ensureProgram(db: Db, key: 'dora' | 'circles'): Promise<string> {
  const [found] = await db.select({ id: programs.id }).from(programs).where(eq(programs.key, key));
  if (found) return found.id;
  await db
    .insert(programs)
    .values(
      key === 'dora'
        ? { key, nameEn: 'Dora', nameUr: 'دورہ' }
        : { key, nameEn: 'Circles', nameUr: 'حلقے' },
    )
    .onConflictDoNothing({ target: programs.key });
  const [row] = await db.select({ id: programs.id }).from(programs).where(eq(programs.key, key));
  if (!row) throw new Error('program row missing');
  return row.id;
}

export function scopeCondition(filter: ScopeFilter): SQL | undefined {
  if (filter.national) return undefined;
  const parts: SQL[] = [];
  if (filter.cityIds.length) parts.push(inArray(venues.cityId, filter.cityIds));
  if (filter.venueIds.length) parts.push(inArray(sessions.venueId, filter.venueIds));
  return parts.length ? or(...parts) : sql`false`;
}

export async function listAdminSessions(
  db: Db,
  now: Date,
  filter: ScopeFilter,
  query: {
    cursor?: string | undefined;
    limit: number;
    cityId?: string | undefined;
    venueId?: string | undefined;
    status?: AdminSession['status'] | undefined;
  },
): Promise<Page<AdminSession>> {
  const offset = decodeOffsetCursor(query.cursor);
  const ids = await db
    .select({ id: sessions.id })
    .from(sessions)
    .innerJoin(venues, eq(venues.id, sessions.venueId))
    .where(
      and(
        scopeCondition(filter),
        query.cityId ? eq(venues.cityId, query.cityId) : undefined,
        query.venueId ? eq(sessions.venueId, query.venueId) : undefined,
        query.status ? eq(sessions.status, query.status) : ne(sessions.status, 'archived'),
      ),
    )
    .orderBy(desc(sessions.createdAt), asc(sessions.id))
    .limit(query.limit + 1)
    .offset(offset);
  const page = offsetPage(ids, query.limit, offset);
  return {
    items: await loadSessions(
      db,
      page.items.map((r) => r.id),
      now,
    ),
    nextCursor: page.nextCursor,
  };
}

/** A session with the venue it belongs to, for the scope check. */
export async function findSessionScope(db: Db, sessionId: string) {
  const [row] = await selectSessionRecords(db).where(eq(sessions.id, sessionId));
  return row ?? null;
}

/**
 * Writes one session and its occurrences up to the horizon (no reference checks, no audit). A
 * Dora session without a season joins the active Dora season, and stops at the season's end.
 * The caller has checked the circle and season ids.
 */
export async function insertSession(
  tx: Db,
  deps: AdminDeps,
  venue: { id: string; cityId: string },
  input: SessionCreate,
): Promise<string> {
  const programId = await ensureProgram(tx, input.program);
  let seasonId = input.seasonId;
  let seasonEnd: string | null = null;
  if (seasonId) {
    const [season] = await tx
      .select({ endsOn: seasons.endsOn })
      .from(seasons)
      .where(eq(seasons.id, seasonId));
    seasonEnd = season?.endsOn ?? null;
  } else if (input.program === 'dora') {
    const [active] = await tx
      .select()
      .from(seasons)
      .where(and(eq(seasons.programId, programId), eq(seasons.isActive, true)))
      .limit(1);
    if (active) {
      seasonId = active.id;
      seasonEnd = active.endsOn;
    }
  }
  const [city] = await tx
    .select({ timezone: cities.timezone })
    .from(cities)
    .where(eq(cities.id, venue.cityId));
  const timezone = city?.timezone ?? 'Asia/Karachi';

  const recurring = input.kind === 'recurring';
  const startsOn = recurring ? input.startsOn : input.date;
  const endsOn = recurring ? input.endsOn : input.date;
  const daysOfWeek = recurring ? [...new Set(input.daysOfWeek)].sort((a, b) => a - b) : [];

  const [row] = await tx
    .insert(sessions)
    .values({
      programId,
      seasonId,
      venueId: venue.id,
      circleId: input.circleId,
      kind: input.kind,
      titleEn: input.title.en,
      titleUr: input.title.ur ?? input.title.en,
      descriptionEn: input.description?.en ?? null,
      descriptionUr: input.description?.ur ?? null,
      section: input.section,
      language: input.language,
      localStartTime: input.localStartTime,
      durationMinutes: input.durationMinutes,
      daysOfWeek,
      startsOn,
      endsOn,
      timezone,
      capacityEnabled: input.capacity !== null,
      capacity: input.capacity,
      registrationEnabled: input.registrationEnabled,
      status: input.status,
    })
    .returning();
  if (!row) throw new Error('session insert returned no row');
  const spec: ScheduleSpec = {
    ...specOf(row),
    endsOn:
      seasonEnd && (!row.endsOn || compareDates(seasonEnd, row.endsOn) < 0)
        ? seasonEnd
        : row.endsOn,
  };
  await materializeSession(tx, row.id, spec, deps.now, deps.horizonDays);
  return row.id;
}

export async function createSession(
  db: Db,
  deps: AdminDeps,
  actorId: string,
  venue: { id: string; cityId: string },
  input: SessionCreate,
): Promise<AdminSession> {
  if (input.circleId) {
    const [circle] = await db
      .select({ venueId: circles.venueId })
      .from(circles)
      .where(eq(circles.id, input.circleId));
    if (!circle) fail('not_found');
    if (circle.venueId !== venue.id) invalid('circleId');
  }
  if (input.seasonId) {
    const [season] = await db
      .select({ programKey: programs.key })
      .from(seasons)
      .innerJoin(programs, eq(programs.id, seasons.programId))
      .where(eq(seasons.id, input.seasonId));
    if (!season) return fail('not_found');
    if (season.programKey !== input.program) invalid('seasonId');
  }
  if (
    input.kind === 'recurring' &&
    input.endsOn &&
    compareDates(input.endsOn, input.startsOn) < 0
  ) {
    // Same code as the import uses for a backwards session row (same day is fine).
    invalid('endsOn', 'invalid_range');
  }

  const sessionId = await db.transaction(async (tx) => {
    const id = await insertSession(tx, deps, venue, input);
    await writeAudit(tx, {
      actorUserId: actorId,
      action: 'session.create',
      entityType: 'session',
      entityId: id,
      scope: venueScope(venue),
      meta: { kind: input.kind, program: input.program },
    });
    return id;
  });
  const [view] = await loadSessions(db, [sessionId], deps.now);
  if (!view) throw new Error('created session not found');
  return view;
}

export interface SessionPatch {
  title?: { en: string; ur?: string | null | undefined } | undefined;
  description?: { en: string; ur?: string | null | undefined } | null | undefined;
  section?: AdminSession['section'] | undefined;
  language?: AdminSession['language'] | undefined;
  registrationEnabled?: boolean | undefined;
  capacity?: number | null | undefined;
  status?: AdminSession['status'] | undefined;
}

export async function updateSession(
  db: Db,
  deps: AdminDeps,
  actorId: string,
  sessionId: string,
  patch: SessionPatch,
): Promise<AdminSession> {
  await db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .for('update');
    if (!current) return fail('not_found');
    const set: Partial<typeof sessions.$inferInsert> = {};
    const fields: string[] = [];
    if (patch.title) {
      set.titleEn = patch.title.en;
      set.titleUr = patch.title.ur ?? patch.title.en;
      fields.push('title');
    }
    if (patch.description !== undefined) {
      set.descriptionEn = patch.description?.en ?? null;
      set.descriptionUr = patch.description?.ur ?? null;
      fields.push('description');
    }
    if (patch.section) {
      set.section = patch.section;
      fields.push('section');
    }
    if (patch.language) {
      set.language = patch.language;
      fields.push('language');
    }
    if (patch.registrationEnabled !== undefined) {
      set.registrationEnabled = patch.registrationEnabled;
      fields.push('registrationEnabled');
    }
    let capacityChanged = false;
    if (patch.capacity !== undefined) {
      set.capacityEnabled = patch.capacity !== null;
      set.capacity = patch.capacity;
      capacityChanged = true;
      fields.push('capacity');
    }
    const cancelling = patch.status === 'cancelled' && current.status !== 'cancelled';
    if (patch.status) {
      set.status = patch.status;
      fields.push('status');
    }
    if (Object.keys(set).length > 0) {
      await tx
        .update(sessions)
        .set({ ...set, updatedAt: deps.now })
        .where(eq(sessions.id, sessionId));
    }
    const facts = await sessionFacts(tx, sessionId);
    if (cancelling && facts) {
      const when = await nextStart(tx, sessionId, deps.now);
      await cancelFutureOccurrences(tx, sessionId, deps.now);
      await publishSessionEvent(tx, deps, {
        actorId,
        session: facts,
        kind: 'cancellation',
        when,
        notify: true,
      });
    } else if (patch.status === 'archived' && current.status !== 'archived') {
      await cancelFutureOccurrences(tx, sessionId, deps.now);
    }
    if (capacityChanged) await promoteWaitlist(tx, deps, sessionId);
    await writeAudit(tx, {
      actorUserId: actorId,
      action: 'session.update',
      entityType: 'session',
      entityId: sessionId,
      scope: facts ? venueScope({ id: facts.venueId, cityId: facts.cityId }) : { type: 'national' },
      meta: { fields },
    });
  });
  const [view] = await loadSessions(db, [sessionId], deps.now);
  if (!view) return fail('not_found');
  return view;
}

export interface ScheduleChange {
  localStartTime?: string | undefined;
  durationMinutes?: number | undefined;
  daysOfWeek?: number[] | undefined;
  endsOn?: string | null | undefined;
  effectiveFrom: string;
  notify: boolean;
}

export async function changeSchedule(
  db: Db,
  deps: AdminDeps,
  actorId: string,
  sessionId: string,
  change: ScheduleChange,
): Promise<ScheduleChangeResponse> {
  const outcome = await db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .for('update');
    if (!current) return fail('not_found');
    if (current.status === 'cancelled') return fail('session_cancelled');
    const oneOff = current.kind === 'one_off';
    if (oneOff && change.daysOfWeek) invalid('daysOfWeek', 'not_allowed');
    if (oneOff && compareDates(current.startsOn, change.effectiveFrom) < 0) {
      invalid('effectiveFrom', 'after_lecture');
    }
    const daysOfWeek = oneOff
      ? []
      : change.daysOfWeek
        ? [...new Set(change.daysOfWeek)].sort((a, b) => a - b)
        : current.daysOfWeek;
    const endsOn = oneOff
      ? current.endsOn
      : change.endsOn !== undefined
        ? change.endsOn
        : current.endsOn;
    if (!oneOff && endsOn && compareDates(endsOn, current.startsOn) < 0) {
      invalid('endsOn', 'invalid_range');
    }

    const localStartTime = change.localStartTime ?? current.localStartTime.slice(0, 5);
    const durationMinutes = change.durationMinutes ?? current.durationMinutes;
    await tx
      .update(sessions)
      .set({ localStartTime, durationMinutes, daysOfWeek, endsOn, updatedAt: deps.now })
      .where(eq(sessions.id, sessionId));

    const spec: ScheduleSpec = {
      kind: current.kind,
      localStartTime,
      durationMinutes,
      daysOfWeek,
      startsOn: current.startsOn,
      endsOn,
      timezone: current.timezone,
    };
    const result = await applyScheduleChange(
      tx,
      sessionId,
      spec,
      change.effectiveFrom,
      deps.now,
      deps.horizonDays,
    );

    const facts = await sessionFacts(tx, sessionId);
    let updatePostedId: string | null = null;
    if (facts && change.notify && result.changed > 0) {
      const when = await nextStart(tx, sessionId, deps.now);
      const posted = await publishSessionEvent(tx, deps, {
        actorId,
        session: facts,
        kind: 'time_change',
        when,
        notify: true,
      });
      updatePostedId = posted.updateId;
    }
    if (facts) {
      await writeAudit(tx, {
        actorUserId: actorId,
        action: 'session.change_schedule',
        entityType: 'session',
        entityId: sessionId,
        scope: venueScope({ id: facts.venueId, cityId: facts.cityId }),
        meta: {
          effectiveFrom: change.effectiveFrom,
          occurrencesChanged: result.changed,
          notify: change.notify,
        },
      });
    }
    return { changed: result.changed, updatePostedId };
  });
  const [view] = await loadSessions(db, [sessionId], deps.now);
  if (!view) return fail('not_found');
  return {
    session: toPublicSession(view),
    occurrencesChanged: outcome.changed,
    updatePostedId: outcome.updatePostedId,
  };
}

export async function listAdminOccurrences(
  db: Db,
  now: Date,
  session: { id: string; timezone: string },
  query: { from?: string | undefined; to?: string | undefined; limit: number },
): Promise<{ items: AdminOccurrence[] }> {
  const defaultFrom = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const from = query.from ? new Date(query.from) : defaultFrom;
  const rows = await db
    .select()
    .from(occurrences)
    .where(
      and(
        eq(occurrences.sessionId, session.id),
        gte(occurrences.endsAt, from),
        query.to ? lte(occurrences.startsAt, new Date(query.to)) : undefined,
      ),
    )
    .orderBy(asc(occurrences.startsAt))
    .limit(query.limit);
  return { items: rows.map(toAdminOccurrence) };
}

export interface OccurrencePatch {
  portion?: PortionValue | null | undefined;
  portionLabel?: string | null | undefined;
  recapNote?: string | null | undefined;
  recapLocale?: 'en' | 'ur' | null | undefined;
  status?: 'scheduled' | 'cancelled' | undefined;
  startsAt?: string | undefined;
  endsAt?: string | undefined;
  notify: boolean;
}

export async function findOccurrence(db: Db, occurrenceId: string) {
  const [row] = await db
    .select({ occurrence: occurrences, venueId: sessions.venueId, cityId: venues.cityId })
    .from(occurrences)
    .innerJoin(sessions, eq(sessions.id, occurrences.sessionId))
    .innerJoin(venues, eq(venues.id, sessions.venueId))
    .where(eq(occurrences.id, occurrenceId));
  return row ?? null;
}

export async function updateOccurrence(
  db: Db,
  deps: AdminDeps,
  actorId: string,
  occurrenceId: string,
  patch: OccurrencePatch,
): Promise<{ occurrence: AdminOccurrence }> {
  try {
    await db.transaction(async (tx) => {
      const current = await findOccurrence(tx, occurrenceId);
      if (!current) return fail('not_found');
      const { occurrence } = current;
      const [session] = await tx
        .select()
        .from(sessions)
        .where(eq(sessions.id, occurrence.sessionId));
      if (!session) return fail('not_found');
      if (session.status === 'cancelled') return fail('session_cancelled');

      const set: Partial<typeof occurrences.$inferInsert> = {};
      const fields: string[] = [];
      if (patch.portion !== undefined) {
        set.portion = patch.portion;
        fields.push('portion');
      }
      if (patch.portionLabel !== undefined) {
        set.portionLabel = patch.portionLabel;
        fields.push('portionLabel');
      }
      if (patch.recapNote !== undefined) {
        set.recapNote = patch.recapNote;
        fields.push('recapNote');
      }
      if (patch.recapLocale !== undefined) {
        set.recapLocale = patch.recapLocale;
        fields.push('recapLocale');
      }
      const startsAt = patch.startsAt ? new Date(patch.startsAt) : occurrence.startsAt;
      const endsAt = patch.endsAt ? new Date(patch.endsAt) : occurrence.endsAt;
      const moved =
        !!(patch.startsAt || patch.endsAt) &&
        (startsAt.getTime() !== occurrence.startsAt.getTime() ||
          endsAt.getTime() !== occurrence.endsAt.getTime());
      if (patch.startsAt || patch.endsAt) {
        if (endsAt <= startsAt) invalid('endsAt', 'before_start');
        set.startsAt = startsAt;
        set.endsAt = endsAt;
        fields.push('time');
      }
      const cancelling = patch.status === 'cancelled' && occurrence.status !== 'cancelled';
      if (patch.status) {
        set.status = patch.status;
        fields.push('status');
      }
      if (Object.keys(set).length > 0) {
        await tx
          .update(occurrences)
          .set({ ...set, updatedAt: deps.now })
          .where(eq(occurrences.id, occurrenceId));
      }
      const facts = await sessionFacts(tx, session.id);
      if (facts && patch.notify && (cancelling || moved)) {
        await publishSessionEvent(tx, deps, {
          actorId,
          session: facts,
          kind: cancelling ? 'cancellation' : 'time_change',
          when: cancelling ? occurrence.startsAt : startsAt,
          notify: true,
        });
      }
      await writeAudit(tx, {
        actorUserId: actorId,
        action: cancelling ? 'occurrence.cancel' : 'occurrence.update',
        entityType: 'occurrence',
        entityId: occurrenceId,
        scope: venueScope({ id: current.venueId, cityId: current.cityId }),
        meta: { fields, notify: patch.notify },
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) return invalid('startsAt', 'clash');
    throw error;
  }
  const row = await findOccurrence(db, occurrenceId);
  if (!row) return fail('not_found');
  return { occurrence: toAdminOccurrence(row.occurrence) };
}
