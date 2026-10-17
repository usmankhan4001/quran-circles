import { and, eq, gt, inArray, isNull, lte, ne, sql } from 'drizzle-orm';
import {
  checkImportRows,
  roleAssignAction,
  type ImportKind,
  type ImportResult,
  type ImportRowResult,
  type InviteBody,
  type ResourceScope,
  type ScopeAction,
  type SessionCreate,
  type ValidationIssue,
  type VenueCreate,
} from '@qc/contracts';
import { schema, type Db } from '../../db';
import { cityScope, nationalScope, venueScope, writeAudit, type AuditScope } from '../shared/audit';
import { fail, isUniqueViolation } from '../shared/errors';
import { enqueueOutbox, type OutboxEntry } from '../shared/outbox';
import { compareDates } from '../shared/time';
import { insertSession, type AdminDeps } from '../sessions/admin';
import { insertVenue } from '../venues/service';
import {
  inviteMessage,
  inviterNameOf,
  inviteValues,
  resolveRoleTarget,
  sameTarget,
  type InviteDeps,
  type RoleTarget,
} from '../roles/service';

/**
 * Bulk import of venues, coordinator invites and sessions. Every row is checked: first its shape
 * with the contract's `checkImportRows` (the same check the console runs), then against the
 * database (references exist, the area is in the city, the caller may act there), then for
 * duplicates (already in the database, or repeated earlier in the request). Nothing is written
 * on a dry run, or when any row is invalid; otherwise every new row is written in one
 * transaction with one audit row that holds only the counts.
 */

const { cities, areas, venues, circles, seasons, programs, sessions, users, roleAssignments } =
  schema;
const { coordinatorInvites } = schema;

/** What the import needs from the request: the caller's id and a non-failing scope check. */
export interface ImportCaller {
  actorId: string;
  allowed(action: ScopeAction, resource: ResourceScope): boolean;
}

type Outcome<T> =
  | { status: 'invalid'; issues: ValidationIssue[] }
  | { status: 'duplicate' }
  | { status: 'created'; value: T; audit: AuditScope };

const issue = (path: string, code: string): ValidationIssue => ({ path, code });
const invalidRow = (...issues: ValidationIssue[]) => ({ status: 'invalid' as const, issues });
const uniq = <T>(values: T[]): T[] => [...new Set(values)];

function summarise(
  dryRun: boolean,
  outcomes: Outcome<unknown>[],
): { result: ImportResult; apply: boolean } {
  const rows: ImportRowResult[] = outcomes.map((o, index) => ({
    index,
    status: o.status,
    issues: o.status === 'invalid' ? o.issues : [],
  }));
  const counts = {
    created: rows.filter((r) => r.status === 'created').length,
    duplicate: rows.filter((r) => r.status === 'duplicate').length,
    invalid: rows.filter((r) => r.status === 'invalid').length,
  };
  const apply = !dryRun && counts.invalid === 0;
  return { result: { dryRun, applied: apply, counts, rows }, apply };
}

/** One venue, one city, or the whole country: the narrowest scope that holds every new row. */
function importScope(scopes: AuditScope[]): AuditScope {
  const venueIds = uniq(scopes.map((s) => s.venueId ?? null));
  const cityIds = uniq(scopes.map((s) => s.cityId ?? null));
  const [onlyVenue] = venueIds;
  const [onlyCity] = cityIds;
  if (scopes.length > 0 && venueIds.length === 1 && onlyVenue && onlyCity && cityIds.length === 1) {
    return venueScope({ id: onlyVenue, cityId: onlyCity });
  }
  if (scopes.length > 0 && cityIds.length === 1 && onlyCity) return cityScope(onlyCity);
  return nationalScope;
}

async function auditImport(
  tx: Db,
  actorId: string,
  kind: ImportKind,
  result: ImportResult,
  scopes: AuditScope[],
): Promise<void> {
  await writeAudit(tx, {
    actorUserId: actorId,
    action: `import.${kind}`,
    entityType: 'import',
    entityId: null,
    scope: importScope(scopes),
    meta: { kind, ...result.counts },
  });
}

/** Rows that changed between the check and the write make the whole import fail cleanly. */
async function inTransaction<T>(db: Db, work: (tx: Db) => Promise<T>): Promise<T> {
  try {
    return await db.transaction(work);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return fail('validation_failed', { issues: [issue('rows', 'changed_during_import')] });
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------------------------
// Venues
// ---------------------------------------------------------------------------------------------

async function checkVenues(
  db: Db,
  caller: ImportCaller,
  raw: readonly unknown[],
): Promise<Outcome<VenueCreate>[]> {
  const checks = checkImportRows('venues', raw);
  const valid = checks.flatMap((c) => (c.ok ? [c.value] : []));
  const cityIds = uniq(valid.map((v) => v.cityId));
  const areaIds = uniq(valid.map((v) => v.areaId));
  const [knownCities, knownAreas, existing] = await Promise.all([
    cityIds.length
      ? db.select({ id: cities.id }).from(cities).where(inArray(cities.id, cityIds))
      : [],
    areaIds.length
      ? db
          .select({ id: areas.id, cityId: areas.cityId })
          .from(areas)
          .where(inArray(areas.id, areaIds))
      : [],
    cityIds.length
      ? db
          .select({ cityId: venues.cityId, name: sql<string>`lower(${venues.nameEn})` })
          .from(venues)
          .where(inArray(venues.cityId, cityIds))
      : [],
  ]);
  const cityKnown = new Set(knownCities.map((c) => c.id));
  const areaCity = new Map(knownAreas.map((a) => [a.id, a.cityId]));
  const taken = new Set(existing.map((v) => `${v.cityId}|${v.name}`));
  const seen = new Set<string>();

  return checks.map((check) => {
    if (!check.ok) return invalidRow(...check.issues);
    const v = check.value;
    // The scope comes first, so an outsider never learns whether a city id exists.
    if (!caller.allowed('venue.create', { cityId: v.cityId })) {
      return invalidRow(issue('cityId', 'forbidden'));
    }
    const issues: ValidationIssue[] = [];
    if (!cityKnown.has(v.cityId)) issues.push(issue('cityId', 'invalid_reference'));
    const areaInCity = areaCity.get(v.areaId);
    if (areaInCity === undefined) issues.push(issue('areaId', 'invalid_reference'));
    else if (areaInCity !== v.cityId) issues.push(issue('areaId', 'area_not_in_city'));
    if (issues.length) return invalidRow(...issues);
    const key = `${v.cityId}|${v.name.en.toLowerCase()}`;
    if (taken.has(key) || seen.has(key)) return { status: 'duplicate' };
    seen.add(key);
    return { status: 'created', value: v, audit: cityScope(v.cityId) };
  });
}

export async function importVenues(
  db: Db,
  caller: ImportCaller,
  body: { dryRun: boolean; rows: readonly unknown[] },
): Promise<ImportResult> {
  const work = async (tx: Db) => {
    const outcomes = await checkVenues(tx, caller, body.rows);
    const { result, apply } = summarise(body.dryRun, outcomes);
    if (!apply) return result;
    const scopes: AuditScope[] = [];
    for (const o of outcomes) {
      if (o.status !== 'created') continue;
      await insertVenue(tx, o.value);
      scopes.push(o.audit);
    }
    await auditImport(tx, caller.actorId, 'venues', result, scopes);
    return result;
  };
  return body.dryRun ? work(db) : inTransaction(db, work);
}

// ---------------------------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------------------------

interface SessionRow {
  input: SessionCreate;
  venue: { id: string; cityId: string };
}

/** Same venue, English title, kind, start time and days (or date): the duplicate key. */
const sessionKey = (
  venueId: string,
  title: string,
  kind: string,
  time: string,
  when: string,
): string => `${venueId}|${title.toLowerCase()}|${kind}|${time.slice(0, 5)}|${when}`;

const whenOf = (s: SessionCreate): string =>
  s.kind === 'one_off'
    ? s.date
    : uniq(s.daysOfWeek)
        .sort((a, b) => a - b)
        .join(',');

async function checkSessions(
  db: Db,
  caller: ImportCaller,
  raw: readonly unknown[],
): Promise<Outcome<SessionRow>[]> {
  const checks = checkImportRows('sessions', raw);
  const valid = checks.flatMap((c) => (c.ok ? [c.value] : []));
  const venueIds = uniq(valid.map((s) => s.venueId));
  const circleIds = uniq(valid.flatMap((s) => (s.circleId ? [s.circleId] : [])));
  const seasonIds = uniq(valid.flatMap((s) => (s.seasonId ? [s.seasonId] : [])));
  const [knownVenues, knownCircles, knownSeasons, existing] = await Promise.all([
    venueIds.length
      ? db
          .select({ id: venues.id, cityId: venues.cityId })
          .from(venues)
          .where(inArray(venues.id, venueIds))
      : [],
    circleIds.length
      ? db
          .select({ id: circles.id, venueId: circles.venueId })
          .from(circles)
          .where(inArray(circles.id, circleIds))
      : [],
    seasonIds.length
      ? db
          .select({ id: seasons.id, programKey: programs.key })
          .from(seasons)
          .innerJoin(programs, eq(programs.id, seasons.programId))
          .where(inArray(seasons.id, seasonIds))
      : [],
    venueIds.length
      ? db
          .select({
            venueId: sessions.venueId,
            titleEn: sessions.titleEn,
            kind: sessions.kind,
            time: sessions.localStartTime,
            daysOfWeek: sessions.daysOfWeek,
            startsOn: sessions.startsOn,
          })
          .from(sessions)
          .where(and(inArray(sessions.venueId, venueIds), ne(sessions.status, 'archived')))
      : [],
  ]);
  const venueById = new Map(knownVenues.map((v) => [v.id, v]));
  const circleVenue = new Map(knownCircles.map((c) => [c.id, c.venueId]));
  const seasonProgram = new Map(knownSeasons.map((s) => [s.id, s.programKey]));
  const taken = new Set(
    existing.map((s) =>
      sessionKey(
        s.venueId,
        s.titleEn,
        s.kind,
        s.time,
        s.kind === 'one_off'
          ? s.startsOn
          : [...s.daysOfWeek].sort((a: number, b: number) => a - b).join(','),
      ),
    ),
  );
  const seen = new Set<string>();

  return checks.map((check) => {
    if (!check.ok) return invalidRow(...check.issues);
    const s = check.value;
    const venue = venueById.get(s.venueId);
    const resource = venue ? { cityId: venue.cityId, venueId: venue.id } : { venueId: s.venueId };
    if (!caller.allowed('session.create', resource)) {
      return invalidRow(issue('venueId', 'forbidden'));
    }
    if (!venue) return invalidRow(issue('venueId', 'invalid_reference'));
    const issues: ValidationIssue[] = [];
    if (s.circleId && circleVenue.get(s.circleId) !== venue.id) {
      issues.push(issue('circleId', 'invalid_reference'));
    }
    if (s.seasonId && seasonProgram.get(s.seasonId) !== s.program) {
      issues.push(issue('seasonId', 'invalid_reference'));
    }
    if (s.kind === 'recurring' && s.endsOn && compareDates(s.endsOn, s.startsOn) < 0) {
      issues.push(issue('endsOn', 'invalid_range'));
    }
    if (issues.length) return invalidRow(...issues);
    const key = sessionKey(venue.id, s.title.en, s.kind, s.localStartTime, whenOf(s));
    if (taken.has(key) || seen.has(key)) return { status: 'duplicate' };
    seen.add(key);
    return { status: 'created', value: { input: s, venue }, audit: venueScope(venue) };
  });
}

export async function importSessions(
  db: Db,
  deps: AdminDeps,
  caller: ImportCaller,
  body: { dryRun: boolean; rows: readonly unknown[] },
): Promise<ImportResult> {
  const work = async (tx: Db) => {
    const outcomes = await checkSessions(tx, caller, body.rows);
    const { result, apply } = summarise(body.dryRun, outcomes);
    if (!apply) return result;
    const scopes: AuditScope[] = [];
    for (const o of outcomes) {
      if (o.status !== 'created') continue;
      await insertSession(tx, deps, o.value.venue, o.value.input);
      scopes.push(o.audit);
    }
    await auditImport(tx, caller.actorId, 'sessions', result, scopes);
    return result;
  };
  return body.dryRun ? work(db) : inTransaction(db, work);
}

// ---------------------------------------------------------------------------------------------
// Coordinators
// ---------------------------------------------------------------------------------------------

interface InviteRowPlan {
  body: InviteBody;
  target: RoleTarget;
}

/** Where a row's place is in the row, for issue paths. */
const placePath = (b: InviteBody): string =>
  'cityId' in b ? 'cityId' : 'venueId' in b ? 'venueId' : 'role';

const placeOf = (b: InviteBody): { cityId?: string; venueId?: string } =>
  'cityId' in b ? { cityId: b.cityId } : 'venueId' in b ? { venueId: b.venueId } : {};

async function checkCoordinators(
  db: Db,
  caller: ImportCaller,
  raw: readonly unknown[],
  now: Date,
): Promise<Outcome<InviteRowPlan>[]> {
  const checks = checkImportRows('coordinators', raw);
  const out: Outcome<InviteRowPlan>[] = [];
  const seen = new Set<string>();
  // Places repeat across rows; look each one up once.
  const targets = new Map<string, RoleTarget | null>();

  for (const check of checks) {
    if (!check.ok) {
      out.push(invalidRow(...check.issues));
      continue;
    }
    const b = check.value;
    const place = placeOf(b);
    const placeKey = `${b.role}|${place.cityId ?? place.venueId ?? ''}`;
    let target = targets.get(placeKey);
    if (target === undefined) {
      target = await resolveRoleTarget(db, { role: b.role, ...place });
      targets.set(placeKey, target);
    }
    const action = roleAssignAction(b.role);
    if (!caller.allowed(action, target?.resource ?? place)) {
      out.push(invalidRow(issue(placePath(b), 'forbidden')));
      continue;
    }
    if (!target) {
      out.push(invalidRow(issue(placePath(b), 'invalid_reference')));
      continue;
    }
    const replacesId = 'replacesAssignmentId' in b ? b.replacesAssignmentId : undefined;
    if (replacesId) {
      const [live] = await db
        .select({ id: roleAssignments.id })
        .from(roleAssignments)
        .where(
          and(
            eq(roleAssignments.id, replacesId),
            isNull(roleAssignments.revokedAt),
            sameTarget(roleAssignments, target),
          ),
        );
      if (!live) {
        out.push(invalidRow(issue('replacesAssignmentId', 'invalid_reference')));
        continue;
      }
    }
    const key = `${b.phone}|${placeKey}`;
    if (seen.has(key) || (await alreadyInvitedOrHeld(db, b.phone, target, now))) {
      out.push({ status: 'duplicate' });
      continue;
    }
    seen.add(key);
    out.push({ status: 'created', value: { body: b, target }, audit: target.audit });
  }
  return out;
}

/** A live pending invite for the number, role and place, or a person who holds that role there. */
async function alreadyInvitedOrHeld(
  db: Db,
  phone: string,
  target: RoleTarget,
  now: Date,
): Promise<boolean> {
  const [pending] = await db
    .select({ id: coordinatorInvites.id })
    .from(coordinatorInvites)
    .where(
      and(
        eq(coordinatorInvites.phoneE164, phone),
        sameTarget(coordinatorInvites, target),
        eq(coordinatorInvites.status, 'pending'),
        gt(coordinatorInvites.expiresAt, now),
      ),
    )
    .limit(1);
  if (pending) return true;
  const [held] = await db
    .select({ id: roleAssignments.id })
    .from(roleAssignments)
    .innerJoin(users, eq(users.id, roleAssignments.userId))
    .where(
      and(
        eq(users.phoneE164, phone),
        isNull(roleAssignments.revokedAt),
        sameTarget(roleAssignments, target),
      ),
    )
    .limit(1);
  return held !== undefined;
}

/**
 * Invites are written in one transaction; their WhatsApp invitations are queued only after it
 * commits, so a rolled-back import never leaves a message behind.
 */
export async function importCoordinators(
  db: Db,
  deps: InviteDeps,
  caller: ImportCaller,
  body: { dryRun: boolean; rows: readonly unknown[] },
): Promise<ImportResult> {
  if (body.dryRun) {
    const outcomes = await checkCoordinators(db, caller, body.rows, deps.now);
    return summarise(true, outcomes).result;
  }
  const written = await inTransaction(db, async (tx) => {
    const outcomes = await checkCoordinators(tx, caller, body.rows, deps.now);
    const { result, apply } = summarise(false, outcomes);
    const invites: { row: typeof coordinatorInvites.$inferSelect; target: RoleTarget }[] = [];
    if (!apply) return { result, invites };
    for (const o of outcomes) {
      if (o.status !== 'created') continue;
      const { body: b, target } = o.value;
      // A lapsed invite still counts as pending to the unique index.
      await tx
        .update(coordinatorInvites)
        .set({ status: 'expired' })
        .where(
          and(
            eq(coordinatorInvites.phoneE164, b.phone),
            sameTarget(coordinatorInvites, target),
            eq(coordinatorInvites.status, 'pending'),
            lte(coordinatorInvites.expiresAt, deps.now),
          ),
        );
      const replacesId = 'replacesAssignmentId' in b ? (b.replacesAssignmentId ?? null) : null;
      const [row] = await tx
        .insert(coordinatorInvites)
        .values(inviteValues(deps, caller.actorId, target, b, replacesId))
        .returning();
      if (!row) throw new Error('invite insert returned no row');
      invites.push({ row, target });
    }
    await auditImport(
      tx,
      caller.actorId,
      'coordinators',
      result,
      invites.map((i) => i.target.audit),
    );
    return { result, invites };
  });

  if (written.invites.length > 0) {
    const phones = written.invites.map((i) => i.row.phoneE164);
    const recipients = await db
      .select({ id: users.id, locale: users.locale, phone: users.phoneE164 })
      .from(users)
      .where(inArray(users.phoneE164, phones));
    const byPhone = new Map(recipients.map((r) => [r.phone, { id: r.id, locale: r.locale }]));
    const inviterName = await inviterNameOf(db, caller.actorId);
    const messages: OutboxEntry[] = written.invites.map(({ row, target }) =>
      inviteMessage(
        row,
        target,
        byPhone.get(row.phoneE164) ?? null,
        inviterName,
        caller.actorId,
        deps.webBase,
      ),
    );
    await enqueueOutbox(db, messages);
  }
  return written.result;
}
