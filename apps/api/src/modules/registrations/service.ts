import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  gte,
  inArray,
  isNull,
  lt,
  ne,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import {
  buildDeepLink,
  type Locale,
  type OutboxPayload,
  type Registration,
  type RegistrationCreate,
  type StaffRegistration,
} from '@qc/contracts';
import { schema, type Db } from '../../db';
import { invalid, fail } from '../shared/errors';
import { isNameMissing, visibleName } from '../shared/names';
import { enqueueOutbox } from '../shared/outbox';
import { decodeOffsetCursor, offsetPage, type Page } from '../shared/pagination';
import { formatWhen } from '../shared/time';
import { applyConsent } from '../me/consents';
import { loadSessions, toPublicSession } from '../sessions/views';
import { sessionFacts, type PublishDeps } from '../updates/publish';
import { promoteWaitlist } from './waitlist';

const { registrations, sessions, venues, circles, occurrences, users, areas, consents } = schema;

type RegistrationRow = typeof registrations.$inferSelect;

const clip = (text: string, max: number): string =>
  text.length <= max ? text : text.slice(0, max);

/** Builds the contract's registration view, with the session nested, for each row. */
export async function toRegistrations(
  db: Db,
  now: Date,
  rows: readonly RegistrationRow[],
): Promise<Registration[]> {
  const views = await loadSessions(
    db,
    rows.map((r) => r.sessionId),
    now,
  );
  const sessionById = new Map(views.map((v) => [v.id, toPublicSession(v)]));
  const out: Registration[] = [];
  for (const r of rows) {
    const session = sessionById.get(r.sessionId);
    if (!session) continue;
    let waitlistPosition: number | null = null;
    if (r.status === 'waitlisted') {
      const [ahead] = await db
        .select({ n: count() })
        .from(registrations)
        .where(
          and(
            eq(registrations.sessionId, r.sessionId),
            eq(registrations.status, 'waitlisted'),
            or(
              lt(registrations.createdAt, r.createdAt),
              and(eq(registrations.createdAt, r.createdAt), lt(registrations.id, r.id)),
            ),
          ),
        );
      waitlistPosition = (ahead?.n ?? 0) + 1;
    }
    out.push({
      id: r.id,
      sessionId: r.sessionId,
      occurrenceId: r.occurrenceId,
      areaId: r.areaId,
      section: r.section,
      partySize: r.partySize,
      status: r.status,
      waitlistPosition,
      createdAt: r.createdAt.toISOString(),
      cancelledAt: r.cancelledAt ? r.cancelledAt.toISOString() : null,
      session,
    });
  }
  return out;
}

export async function createRegistration(
  db: Db,
  deps: PublishDeps,
  userId: string,
  input: RegistrationCreate,
): Promise<Registration> {
  const now = deps.now;
  const id = await db.transaction(async (tx) => {
    // Public visibility, but a cancelled session must answer session_cancelled, not not_found.
    const [visible] = await tx
      .select({ id: sessions.id })
      .from(sessions)
      .innerJoin(venues, eq(venues.id, sessions.venueId))
      .leftJoin(circles, eq(circles.id, sessions.circleId))
      .where(
        and(
          eq(sessions.id, input.sessionId),
          inArray(sessions.status, ['published', 'cancelled']),
          eq(venues.status, 'active'),
          or(isNull(sessions.circleId), eq(circles.status, 'published')),
        ),
      );
    if (!visible) return fail('not_found');
    const [session] = await tx
      .select()
      .from(sessions)
      .where(eq(sessions.id, input.sessionId))
      .for('update');
    if (!session) return fail('not_found');
    if (session.status === 'cancelled') return fail('session_cancelled');
    if (!session.registrationEnabled) return fail('registration_closed');

    let occurrenceId: string | null = null;
    if (input.occurrenceId) {
      const [occ] = await tx
        .select()
        .from(occurrences)
        .where(eq(occurrences.id, input.occurrenceId));
      if (!occ || occ.sessionId !== session.id) return fail('not_found');
      if (occ.status === 'cancelled') return fail('session_cancelled');
      if (occ.endsAt <= now) return fail('occurrence_in_past');
      occurrenceId = occ.id;
    } else {
      const [upcoming] = await tx
        .select({ id: occurrences.id })
        .from(occurrences)
        .where(
          and(
            eq(occurrences.sessionId, session.id),
            eq(occurrences.status, 'scheduled'),
            gte(occurrences.endsAt, now),
          ),
        )
        .limit(1);
      if (!upcoming)
        return fail(session.kind === 'one_off' ? 'occurrence_in_past' : 'registration_closed');
    }

    const [area] = await tx.select({ id: areas.id }).from(areas).where(eq(areas.id, input.areaId));
    if (!area) return fail('not_found');

    const [user] = await tx.select().from(users).where(eq(users.id, userId));
    if (!user) return fail('unauthenticated');
    let displayName = user.displayName;
    if (input.name) {
      displayName = input.name;
      await tx.update(users).set({ displayName }).where(eq(users.id, userId));
    } else if (isNameMissing(displayName)) {
      invalid('name', 'required');
    }
    // The name was required above, so it is set from here on.
    const name = displayName as string;

    const [existing] = await tx
      .select({ id: registrations.id })
      .from(registrations)
      .where(
        and(
          eq(registrations.userId, userId),
          eq(registrations.sessionId, session.id),
          ne(registrations.status, 'cancelled'),
        ),
      );
    if (existing) return fail('already_registered');

    // Capacity is optional and off by default. When it is on, a full session has a waitlist.
    let status: 'confirmed' | 'waitlisted' = 'confirmed';
    if (session.capacityEnabled && session.capacity !== null) {
      if (input.partySize > session.capacity) return fail('session_full');
      const [taken] = await tx
        .select({
          seats: sql<number>`coalesce(sum(${registrations.partySize}), 0)`.mapWith(Number),
        })
        .from(registrations)
        .where(and(eq(registrations.sessionId, session.id), eq(registrations.status, 'confirmed')));
      const [waiting] = await tx
        .select({ n: count() })
        .from(registrations)
        .where(
          and(eq(registrations.sessionId, session.id), eq(registrations.status, 'waitlisted')),
        );
      const fits = (taken?.seats ?? 0) + input.partySize <= session.capacity;
      status = fits && (waiting?.n ?? 0) === 0 ? 'confirmed' : 'waitlisted';
    }

    const [created] = await tx
      .insert(registrations)
      .values({
        userId,
        sessionId: session.id,
        occurrenceId,
        areaId: input.areaId,
        section: input.section,
        partySize: input.partySize,
        status,
        createdAt: now,
      })
      .returning();
    if (!created) throw new Error('registration insert returned no row');

    // The registration checkbox is the WhatsApp consent. Record it either way.
    for (const purpose of ['registration_updates', 'session_reminders'] as const) {
      await applyConsent(
        tx,
        userId,
        now,
        { channel: 'whatsapp', purpose, venueId: null, granted: input.allowWhatsapp },
        'registration',
      );
    }

    if (status === 'confirmed' && input.allowWhatsapp) {
      const facts = await sessionFacts(tx, session.id);
      if (facts) {
        const locale: Locale = user.locale;
        let start: Date | null;
        if (occurrenceId) {
          const [o] = await tx
            .select({ startsAt: occurrences.startsAt })
            .from(occurrences)
            .where(eq(occurrences.id, occurrenceId));
          start = o?.startsAt ?? null;
        } else {
          const [o] = await tx
            .select({ startsAt: occurrences.startsAt })
            .from(occurrences)
            .where(
              and(
                eq(occurrences.sessionId, session.id),
                eq(occurrences.status, 'scheduled'),
                gte(occurrences.endsAt, now),
              ),
            )
            .orderBy(asc(occurrences.startsAt))
            .limit(1);
          start = o?.startsAt ?? null;
        }
        const payload: OutboxPayload = {
          channel: 'whatsapp',
          template: 'registration_confirmation',
          locale,
          variables: {
            name: clip(name, 200),
            sessionTitle: clip(locale === 'ur' ? facts.titleUr : facts.titleEn, 200),
            venueName: clip(locale === 'ur' ? facts.venueNameUr : facts.venueNameEn, 200),
            when: clip(start ? formatWhen(start, facts.timezone, locale) : '-', 200),
            link: buildDeepLink({ type: 'session', sessionId: session.id }, deps.webBase),
          },
        };
        await enqueueOutbox(tx, [
          {
            key: `registration_confirmation:${created.id}:whatsapp`,
            payload,
            recipientUserId: userId,
            recipientPhone: user.phoneE164,
            cityId: facts.cityId,
            venueId: facts.venueId,
          },
        ]);
      }
    }
    return created.id;
  });
  const [row] = await db.select().from(registrations).where(eq(registrations.id, id));
  const [view] = await toRegistrations(db, now, row ? [row] : []);
  if (!view) return fail('internal_error');
  return view;
}

export async function listMyRegistrations(
  db: Db,
  now: Date,
  userId: string,
  query: {
    cursor?: string | undefined;
    limit: number;
    includeCancelled?: boolean | undefined;
    upcomingOnly?: boolean | undefined;
  },
): Promise<Page<Registration>> {
  const offset = decodeOffsetCursor(query.cursor);
  const conditions: (SQL | undefined)[] = [eq(registrations.userId, userId)];
  if (!query.includeCancelled) conditions.push(ne(registrations.status, 'cancelled'));
  if (query.upcomingOnly) {
    conditions.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(occurrences)
          .where(
            and(
              eq(occurrences.sessionId, registrations.sessionId),
              or(
                isNull(registrations.occurrenceId),
                eq(occurrences.id, registrations.occurrenceId),
              ),
              eq(occurrences.status, 'scheduled'),
              gte(occurrences.endsAt, now),
            ),
          ),
      ),
    );
  }
  const rows = await db
    .select()
    .from(registrations)
    .where(and(...conditions))
    .orderBy(desc(registrations.createdAt), asc(registrations.id))
    .limit(query.limit + 1)
    .offset(offset);
  const page = offsetPage(rows, query.limit, offset);
  return { items: await toRegistrations(db, now, page.items), nextCursor: page.nextCursor };
}

export async function cancelRegistration(
  db: Db,
  deps: PublishDeps,
  userId: string,
  registrationId: string,
): Promise<Registration> {
  await db.transaction(async (tx) => {
    const [reg] = await tx
      .select()
      .from(registrations)
      .where(and(eq(registrations.id, registrationId), eq(registrations.userId, userId)));
    if (!reg) return fail('not_found');
    if (reg.status === 'cancelled') return;
    // Lock the session first so a cancellation and a new registration take turns.
    await tx
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.id, reg.sessionId))
      .for('update');
    await tx
      .update(registrations)
      .set({ status: 'cancelled', cancelledAt: deps.now })
      .where(eq(registrations.id, registrationId));
    await promoteWaitlist(tx, deps, reg.sessionId);
  });
  const [row] = await db.select().from(registrations).where(eq(registrations.id, registrationId));
  const [view] = await toRegistrations(db, deps.now, row ? [row] : []);
  if (!view) return fail('not_found');
  return view;
}

// ---------------------------------------------------------------------------------------------
// Staff views
// ---------------------------------------------------------------------------------------------

interface StaffRow {
  r: RegistrationRow;
  name: string | null;
  phone: string | null;
}

async function staffRows(
  db: Db,
  sessionId: string,
  filters: { occurrenceId?: string | undefined; status?: RegistrationRow['status'] | undefined },
  window?: { limit: number; offset: number },
): Promise<StaffRow[]> {
  const base = db
    .select({ r: registrations, name: users.displayName, phone: users.phoneE164 })
    .from(registrations)
    .leftJoin(users, eq(users.id, registrations.userId))
    .where(
      and(
        eq(registrations.sessionId, sessionId),
        filters.occurrenceId ? eq(registrations.occurrenceId, filters.occurrenceId) : undefined,
        filters.status
          ? eq(registrations.status, filters.status)
          : ne(registrations.status, 'cancelled'),
      ),
    )
    .orderBy(asc(registrations.createdAt), asc(registrations.id));
  const rows = window ? await base.limit(window.limit).offset(window.offset) : await base;
  return rows.map((row) => ({ r: row.r, name: visibleName(row.name), phone: row.phone }));
}

async function whatsappUsers(db: Db, userIds: readonly string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const rows = await db
    .selectDistinct({ userId: consents.userId })
    .from(consents)
    .where(
      and(
        inArray(consents.userId, [...userIds]),
        eq(consents.channel, 'whatsapp'),
        eq(consents.purpose, 'registration_updates'),
        isNull(consents.revokedAt),
      ),
    );
  return new Set(rows.map((r) => r.userId));
}

const toStaff = (row: StaffRow, whatsapp: Set<string>): StaffRegistration => ({
  id: row.r.id,
  name: row.name,
  phone: row.phone,
  areaId: row.r.areaId,
  section: row.r.section,
  partySize: row.r.partySize,
  status: row.r.status,
  occurrenceId: row.r.occurrenceId,
  allowsWhatsapp: row.r.userId ? whatsapp.has(row.r.userId) : false,
  createdAt: row.r.createdAt.toISOString(),
});

export async function listSessionRegistrations(
  db: Db,
  sessionId: string,
  query: {
    cursor?: string | undefined;
    limit: number;
    occurrenceId?: string | undefined;
    status?: RegistrationRow['status'] | undefined;
  },
) {
  const offset = decodeOffsetCursor(query.cursor);
  const rows = await staffRows(db, sessionId, query, { limit: query.limit + 1, offset });
  const page = offsetPage(rows, query.limit, offset);
  const whatsapp = await whatsappUsers(
    db,
    page.items.flatMap((r) => (r.r.userId ? [r.r.userId] : [])),
  );
  const [totals] = await db
    .select({
      registrations: count(),
      people:
        sql<number>`coalesce(sum(${registrations.partySize}) filter (where ${registrations.status} = 'confirmed'), 0)`.mapWith(
          Number,
        ),
      waitlisted:
        sql<number>`count(*) filter (where ${registrations.status} = 'waitlisted')`.mapWith(Number),
    })
    .from(registrations)
    .where(
      and(
        eq(registrations.sessionId, sessionId),
        ne(registrations.status, 'cancelled'),
        query.occurrenceId ? eq(registrations.occurrenceId, query.occurrenceId) : undefined,
      ),
    );
  return {
    items: page.items.map((row) => toStaff(row, whatsapp)),
    nextCursor: page.nextCursor,
    totals: {
      registrations: totals?.registrations ?? 0,
      people: totals?.people ?? 0,
      waitlisted: totals?.waitlisted ?? 0,
    },
  };
}

/** Quote a CSV cell, and defuse spreadsheet formulas in text that people typed. */
export function csvCell(value: string | number | null): string {
  if (value === null) return '';
  let text = String(value);
  const isPhone = /^\+[0-9]{8,15}$/.test(text);
  if (!isPhone && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function exportSessionRegistrations(db: Db, sessionId: string): Promise<string> {
  const rows = await staffRows(db, sessionId, {});
  const whatsapp = await whatsappUsers(
    db,
    rows.flatMap((r) => (r.r.userId ? [r.r.userId] : [])),
  );
  const header = ['name', 'phone', 'section', 'party_size', 'status', 'whatsapp', 'registered_at'];
  const lines = [header.join(',')];
  for (const row of rows) {
    const s = toStaff(row, whatsapp);
    lines.push(
      [
        csvCell(s.name),
        csvCell(s.phone),
        csvCell(s.section),
        csvCell(s.partySize),
        csvCell(s.status),
        csvCell(s.allowsWhatsapp ? 'yes' : 'no'),
        csvCell(s.createdAt),
      ].join(','),
    );
  }
  // The byte order mark lets Excel read Urdu names correctly.
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
