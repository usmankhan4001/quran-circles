import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lte,
  or,
  sql,
  type AnyColumn,
  type SQL,
} from 'drizzle-orm';
import {
  buildDeepLink,
  INVITE_DAILY_LIMIT,
  type AssignRoleBody,
  type Invite,
  type InviteBody,
  type Localized,
  type Role,
  type ScopeFilter,
  type ScopeType,
} from '@qc/contracts';
import type { StaffRoleAssignment } from '../shared/types';
import { schema, type Db } from '../../db';
import { cityScope, nationalScope, venueScope, writeAudit, type AuditScope } from '../shared/audit';
import { fail, invalid, isUniqueViolation } from '../shared/errors';
import { localized } from '../shared/mappers';
import { visibleName } from '../shared/names';
import { MS_PER_DAY } from '../shared/time';
import { decodeOffsetCursor, offsetPage, type Page } from '../shared/pagination';
import { enqueueOutbox, type OutboxEntry } from '../shared/outbox';

const { roleAssignments, coordinatorInvites, users, cities, venues } = schema;

/** Where a role applies: nowhere in particular (national), a city, or a venue. */
export interface RoleTarget {
  role: Role;
  scopeType: ScopeType;
  cityId: string | null;
  venueId: string | null;
  /** The city and venue `can` needs to decide. */
  resource: { cityId?: string; venueId?: string };
  scopeName: Localized | null;
  audit: AuditScope;
}

export async function resolveRoleTarget(
  db: Db,
  input: { role: Role; cityId?: string | null; venueId?: string | null },
): Promise<RoleTarget | null> {
  // The place decides the scope; the contract and the database keep role and place consistent.
  if (input.cityId) {
    const [city] = await db.select().from(cities).where(eq(cities.id, input.cityId));
    if (!city) return null;
    return {
      role: input.role,
      scopeType: 'city',
      cityId: city.id,
      venueId: null,
      resource: { cityId: city.id },
      scopeName: localized(city.nameEn, city.nameUr),
      audit: cityScope(city.id),
    };
  }
  if (input.venueId) {
    const [venue] = await db.select().from(venues).where(eq(venues.id, input.venueId));
    if (!venue) return null;
    return {
      role: input.role,
      scopeType: 'venue',
      cityId: null,
      venueId: venue.id,
      resource: { cityId: venue.cityId, venueId: venue.id },
      scopeName: localized(venue.nameEn, venue.nameUr),
      audit: venueScope(venue),
    };
  }
  return {
    role: input.role,
    scopeType: 'national',
    cityId: null,
    venueId: null,
    resource: {},
    scopeName: null,
    audit: nationalScope,
  };
}

/** The target an existing assignment or invite points at, for the scope check. */
export async function targetOfRow(
  db: Db,
  row: { role: Role; cityId: string | null; venueId: string | null },
): Promise<RoleTarget | null> {
  return resolveRoleTarget(db, row);
}

/** Same role at the same place: the unit the database keeps one live assignment per person for. */
export const sameTarget = (
  table: { role: AnyColumn; cityId: AnyColumn; venueId: AnyColumn },
  target: RoleTarget,
): SQL =>
  and(
    eq(table.role, target.role),
    target.cityId ? eq(table.cityId, target.cityId) : isNull(table.cityId),
    target.venueId ? eq(table.venueId, target.venueId) : isNull(table.venueId),
  ) as SQL;

// ---------------------------------------------------------------------------------------------
// Invites
// ---------------------------------------------------------------------------------------------

type InviteRow = typeof coordinatorInvites.$inferSelect;

/** A pending invite past its expiry reads as expired even before anything marks it. */
const toInvite = (r: InviteRow, now: Date): Invite => ({
  id: r.id,
  phone: r.phoneE164,
  email: r.email,
  displayName: r.displayName,
  role: r.role,
  scopeType: r.scopeType,
  cityId: r.cityId,
  venueId: r.venueId,
  status: r.status === 'pending' && r.expiresAt <= now ? 'expired' : r.status,
  createdAt: r.createdAt.toISOString(),
  expiresAt: r.expiresAt.toISOString(),
  replacesAssignmentId: r.replacesAssignmentId,
});

export interface InviteLimits {
  /** Rows in one coordinator import. */
  perImport: number;
  /** Invitations one person may send in any 24 hours, every path together. */
  perActorPerDay: number;
}

export interface InviteDeps {
  now: Date;
  ttlDays: number;
  webBase?: string | undefined;
  limits: InviteLimits;
}

const INVITE_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * SEC-03: every invitation is a paid WhatsApp message to a number the inviter typed, so one person
 * may send at most `perActorPerDay` in any 24 hours (single invites, resends and imports together).
 * Counts the invites they created in the window (`createdAt` is the request time); refuses with
 * `validation_failed`, issue `rows` / `invite_daily_limit` (`invite_daily_limit` on `phone` for a
 * single invite), when `adding` more would pass the ceiling. Nothing is written by the check.
 *
 * Inside a transaction it first takes a transaction-scoped advisory lock for the inviter, so two
 * requests by the same person (on one API process or several) count one after the other and cannot
 * both take the last invites: the second sees the first's rows once it commits. Outside one (a dry
 * run) the lock is released at once and the answer is only a preview.
 */
export async function assertInviteAllowance(
  db: Db,
  actorId: string,
  adding: number,
  deps: Pick<InviteDeps, 'now' | 'limits'>,
  path: 'rows' | 'phone',
): Promise<void> {
  if (adding <= 0) return;
  await db.execute(sql`select pg_advisory_xact_lock(hashtext(${`invite_allowance:${actorId}`}))`);
  const [row] = await db
    .select({ n: count() })
    .from(coordinatorInvites)
    .where(
      and(
        eq(coordinatorInvites.invitedBy, actorId),
        gt(coordinatorInvites.createdAt, new Date(deps.now.getTime() - INVITE_WINDOW_MS)),
      ),
    );
  if ((row?.n ?? 0) + adding > deps.limits.perActorPerDay) {
    fail('validation_failed', { issues: [{ path, code: INVITE_DAILY_LIMIT }] });
  }
}

type Tx = Db;

/** A lapsed invite still counts as pending to the database (unique index), so retire it first. */
async function retireLapsedInvites(tx: Tx, phone: string, target: RoleTarget, now: Date) {
  await tx
    .update(coordinatorInvites)
    .set({ status: 'expired' })
    .where(
      and(
        eq(coordinatorInvites.phoneE164, phone),
        sameTarget(coordinatorInvites, target),
        eq(coordinatorInvites.status, 'pending'),
        lte(coordinatorInvites.expiresAt, now),
      ),
    );
}

/** The account behind a number, if any, and whether it already holds this role at this place. */
export async function roleHolder(
  tx: Tx,
  phone: string,
  target: RoleTarget,
): Promise<{ user: { id: string; locale: 'en' | 'ur' } | null; holds: boolean }> {
  const [user] = await tx
    .select({ id: users.id, locale: users.locale })
    .from(users)
    .where(eq(users.phoneE164, phone));
  if (!user) return { user: null, holds: false };
  const [holds] = await tx
    .select({ id: roleAssignments.id })
    .from(roleAssignments)
    .where(
      and(
        eq(roleAssignments.userId, user.id),
        isNull(roleAssignments.revokedAt),
        sameTarget(roleAssignments, target),
      ),
    )
    .limit(1);
  return { user, holds: holds !== undefined };
}

/** The live pending invite for this number, role and place, if any. */
export async function pendingInvite(
  tx: Tx,
  phone: string,
  target: RoleTarget,
  now: Date,
): Promise<InviteRow | null> {
  const [row] = await tx
    .select()
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
  return row ?? null;
}

/**
 * Whether an assignment can be handed over by an invite for `target`: it exists, is live, and is
 * the same role at the same place. Anything else reads as not found, so an id outside the
 * caller's scope is never confirmed.
 */
export async function handoverAssignmentExists(
  tx: Tx,
  assignmentId: string,
  target: RoleTarget,
): Promise<boolean> {
  const [row] = await tx
    .select({ id: roleAssignments.id })
    .from(roleAssignments)
    .where(
      and(
        eq(roleAssignments.id, assignmentId),
        isNull(roleAssignments.revokedAt),
        sameTarget(roleAssignments, target),
      ),
    );
  return row !== undefined;
}

const scopeNameIn = (target: RoleTarget, locale: 'en' | 'ur'): string =>
  target.scopeName
    ? locale === 'ur' && target.scopeName.ur
      ? target.scopeName.ur
      : target.scopeName.en
    : 'Quran Circles';

/** The WhatsApp invitation for one invite row. Coordinator invitations need no consent. */
export function inviteMessage(
  row: InviteRow,
  target: RoleTarget,
  recipient: { id: string; locale: 'en' | 'ur' } | null,
  inviterName: string | null,
  actorId: string,
  webBase: string | undefined,
): OutboxEntry {
  const locale = recipient?.locale ?? 'en';
  return {
    key: `coordinator_invite:${row.id}:whatsapp`,
    payload: {
      channel: 'whatsapp',
      template: 'coordinator_invite',
      locale,
      variables: {
        inviterName: (inviterName ?? 'Quran Circles').slice(0, 200),
        scopeName: scopeNameIn(target, locale).slice(0, 200),
        link: buildDeepLink({ type: 'updates' }, webBase),
      },
    },
    recipientUserId: recipient?.id ?? null,
    recipientPhone: row.phoneE164,
    cityId: target.cityId ?? target.resource.cityId ?? null,
    venueId: target.venueId,
    sentBy: actorId,
  };
}

export async function inviterNameOf(db: Db, actorId: string): Promise<string | null> {
  const [inviter] = await db
    .select({ name: users.displayName })
    .from(users)
    .where(eq(users.id, actorId));
  return visibleName(inviter?.name);
}

export const inviteValues = (
  deps: InviteDeps,
  actorId: string,
  target: RoleTarget,
  body: { phone: string; email?: string | undefined; displayName?: string | undefined },
  replacesAssignmentId: string | null,
): typeof coordinatorInvites.$inferInsert => ({
  phoneE164: body.phone,
  email: body.email ?? null,
  displayName: body.displayName ?? null,
  role: target.role,
  scopeType: target.scopeType,
  cityId: target.cityId,
  venueId: target.venueId,
  invitedBy: actorId,
  replacesAssignmentId,
  status: 'pending',
  createdAt: deps.now,
  expiresAt: new Date(deps.now.getTime() + deps.ttlDays * MS_PER_DAY),
});

/**
 * Whether `assignmentId` may be named as the handover of a new invite to `phone` for `target`.
 * It is `'live'` when the assignment is live and the same role at the same place (the handover ends
 * it now), `'handed_over'` when an earlier handover invite to this same number for this role and
 * place already ended it (a resend that copies the link: nothing is left to end), and `null`
 * otherwise, which reads as not found so an id outside the caller's scope is never confirmed.
 */
async function handoverLink(
  tx: Tx,
  assignmentId: string,
  phone: string,
  target: RoleTarget,
): Promise<'live' | 'handed_over' | null> {
  if (await handoverAssignmentExists(tx, assignmentId, target)) return 'live';
  const [earlier] = await tx
    .select({ id: coordinatorInvites.id })
    .from(coordinatorInvites)
    .innerJoin(roleAssignments, eq(roleAssignments.id, coordinatorInvites.replacesAssignmentId))
    .where(
      and(
        eq(coordinatorInvites.replacesAssignmentId, assignmentId),
        eq(coordinatorInvites.phoneE164, phone),
        sameTarget(coordinatorInvites, target),
        sameTarget(roleAssignments, target),
      ),
    )
    .limit(1);
  return earlier ? 'handed_over' : null;
}

/**
 * SEC-22: a handover ends the previous holder's access at once, when the invite is created, not
 * when the new coordinator accepts it (`docs/product/decisions.md`: "the previous coordinator
 * loses access at once"). Revokes the assignment if it is still live, with a `role.revoke` audit
 * row (`reason: 'handover'`). Returns whether it ended anything.
 */
export async function endHandedOverAssignment(
  tx: Tx,
  input: { assignmentId: string; inviteId: string; actorId: string; target: RoleTarget; now: Date },
): Promise<boolean> {
  const [ended] = await tx
    .update(roleAssignments)
    .set({ revokedAt: input.now })
    .where(
      and(
        eq(roleAssignments.id, input.assignmentId),
        isNull(roleAssignments.revokedAt),
        sameTarget(roleAssignments, input.target),
      ),
    )
    .returning({ id: roleAssignments.id });
  if (!ended) return false;
  await writeAudit(tx, {
    actorUserId: input.actorId,
    action: 'role.revoke',
    entityType: 'role_assignment',
    entityId: ended.id,
    scope: input.target.audit,
    meta: { role: input.target.role, reason: 'handover', inviteId: input.inviteId },
  });
  return true;
}

/**
 * Invites a person to a role. With `replacesAssignmentId` it is a handover: the replaced
 * assignment is revoked in the same transaction (SEC-22), so the previous coordinator loses access
 * at once, and the invite stays pending until the new coordinator signs in. Inviting a number again
 * for the same role and place is a resend: the pending invite is replaced by a new one with a fresh
 * expiry, and the message goes out again. A resend keeps the handover link (the body may repeat
 * it, or leave it out while a pending invite carries it).
 */
export async function createInvite(
  db: Db,
  deps: InviteDeps,
  actorId: string,
  target: RoleTarget,
  body: InviteBody,
): Promise<Invite> {
  const replacesId = 'replacesAssignmentId' in body ? body.replacesAssignmentId : undefined;
  try {
    const invite = await db.transaction(async (tx) => {
      // The allowance first: it takes the inviter's lock before this request touches any row.
      await assertInviteAllowance(tx, actorId, 1, deps, 'phone');
      await retireLapsedInvites(tx, body.phone, target, deps.now);
      const { user: existing, holds } = await roleHolder(tx, body.phone, target);
      if (holds) return fail('role_already_assigned');
      if (replacesId && !(await handoverLink(tx, replacesId, body.phone, target))) {
        return fail('not_found');
      }

      // Resend: the pending invite gives way to this one, and its handover link is carried over
      // when the body names none.
      const previous = await pendingInvite(tx, body.phone, target, deps.now);
      const carried =
        !replacesId &&
        previous?.replacesAssignmentId &&
        (await handoverLink(tx, previous.replacesAssignmentId, body.phone, target))
          ? previous.replacesAssignmentId
          : null;
      if (previous) {
        await tx
          .update(coordinatorInvites)
          .set({ status: 'revoked' })
          .where(
            and(eq(coordinatorInvites.id, previous.id), eq(coordinatorInvites.status, 'pending')),
          );
      }

      const [row] = await tx
        .insert(coordinatorInvites)
        .values(inviteValues(deps, actorId, target, body, replacesId ?? carried))
        .returning();
      if (!row) throw new Error('invite insert returned no row');

      await writeAudit(tx, {
        actorUserId: actorId,
        action: 'role.invite',
        entityType: 'invite',
        entityId: row.id,
        scope: target.audit,
        meta: {
          role: target.role,
          replacesInviteId: previous?.id ?? null,
          replacesAssignmentId: row.replacesAssignmentId,
        },
      });
      if (row.replacesAssignmentId) {
        await endHandedOverAssignment(tx, {
          assignmentId: row.replacesAssignmentId,
          inviteId: row.id,
          actorId,
          target,
          now: deps.now,
        });
      }

      await enqueueOutbox(tx, [
        inviteMessage(
          row,
          target,
          existing,
          await inviterNameOf(tx, actorId),
          actorId,
          deps.webBase,
        ),
      ]);
      return row;
    });
    return toInvite(invite, deps.now);
  } catch (error) {
    if (isUniqueViolation(error)) return fail('conflict');
    throw error;
  }
}

function inviteScope(filter: ScopeFilter): SQL {
  if (filter.national) return sql`true`;
  if (filter.cityIds.length === 0) return sql`false`;
  return or(
    inArray(coordinatorInvites.cityId, filter.cityIds),
    inArray(venues.cityId, filter.cityIds),
  ) as SQL;
}

export async function listInvites(
  db: Db,
  now: Date,
  filter: ScopeFilter,
): Promise<{ items: Invite[] }> {
  const rows = await db
    .select({ invite: coordinatorInvites })
    .from(coordinatorInvites)
    .leftJoin(venues, eq(venues.id, coordinatorInvites.venueId))
    .where(inviteScope(filter))
    .orderBy(desc(coordinatorInvites.createdAt), asc(coordinatorInvites.id))
    .limit(200);
  return { items: rows.map((r) => toInvite(r.invite, now)) };
}

export async function findInvite(db: Db, inviteId: string) {
  const [row] = await db
    .select()
    .from(coordinatorInvites)
    .where(eq(coordinatorInvites.id, inviteId));
  return row ?? null;
}

export async function revokeInvite(
  db: Db,
  now: Date,
  actorId: string,
  invite: InviteRow,
  target: RoleTarget,
): Promise<void> {
  if (invite.status === 'revoked') return;
  if (invite.status === 'expired' || (invite.status === 'pending' && invite.expiresAt <= now)) {
    return fail('invite_expired');
  }
  // An accepted invite is already a role assignment; revoke that instead.
  if (invite.status !== 'pending') return fail('not_found');
  await db.transaction(async (tx) => {
    const [changed] = await tx
      .update(coordinatorInvites)
      .set({ status: 'revoked' })
      .where(and(eq(coordinatorInvites.id, invite.id), eq(coordinatorInvites.status, 'pending')))
      .returning({ id: coordinatorInvites.id });
    if (!changed) return fail('not_found');
    await writeAudit(tx, {
      actorUserId: actorId,
      action: 'role.revoke_invite',
      entityType: 'invite',
      entityId: invite.id,
      scope: target.audit,
      meta: { role: invite.role },
    });
  });
}

// ---------------------------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------------------------

const assignmentColumns = {
  a: roleAssignments,
  userName: users.displayName,
  phone: users.phoneE164,
  cityEn: cities.nameEn,
  cityUr: cities.nameUr,
  venueEn: venues.nameEn,
  venueUr: venues.nameUr,
  venueCityId: venues.cityId,
};

const selectAssignments = (db: Db) =>
  db
    .select(assignmentColumns)
    .from(roleAssignments)
    .innerJoin(users, eq(users.id, roleAssignments.userId))
    .leftJoin(cities, eq(cities.id, roleAssignments.cityId))
    .leftJoin(venues, eq(venues.id, roleAssignments.venueId));

type AssignmentRecord = Awaited<ReturnType<typeof selectAssignments>>[number];

function toAssignment(r: AssignmentRecord): StaffRoleAssignment {
  const a = r.a;
  return {
    id: a.id,
    userId: a.userId,
    userName: visibleName(r.userName),
    phone: r.phone,
    role: a.role,
    scopeType: a.scopeType,
    cityId: a.cityId,
    venueId: a.venueId,
    scopeName:
      a.scopeType === 'venue' && r.venueEn
        ? localized(r.venueEn, r.venueUr)
        : a.scopeType === 'city' && r.cityEn
          ? localized(r.cityEn, r.cityUr)
          : null,
    createdAt: a.createdAt.toISOString(),
    revokedAt: a.revokedAt ? a.revokedAt.toISOString() : null,
  };
}

export async function findAssignment(db: Db, assignmentId: string) {
  const [row] = await selectAssignments(db).where(eq(roleAssignments.id, assignmentId));
  return row ?? null;
}

function assignmentScope(filter: ScopeFilter): SQL {
  if (filter.national) return sql`true`;
  if (filter.cityIds.length === 0) return sql`false`;
  return or(
    inArray(roleAssignments.cityId, filter.cityIds),
    inArray(venues.cityId, filter.cityIds),
  ) as SQL;
}

export async function listAssignments(
  db: Db,
  filter: ScopeFilter,
  query: {
    cursor?: string | undefined;
    limit: number;
    cityId?: string | undefined;
    venueId?: string | undefined;
    includeRevoked?: boolean | undefined;
  },
): Promise<Page<StaffRoleAssignment>> {
  const offset = decodeOffsetCursor(query.cursor);
  const rows = await selectAssignments(db)
    .where(
      and(
        assignmentScope(filter),
        query.includeRevoked ? undefined : isNull(roleAssignments.revokedAt),
        query.cityId
          ? or(eq(roleAssignments.cityId, query.cityId), eq(venues.cityId, query.cityId))
          : undefined,
        query.venueId ? eq(roleAssignments.venueId, query.venueId) : undefined,
      ),
    )
    .orderBy(desc(roleAssignments.createdAt), asc(roleAssignments.id))
    .limit(query.limit + 1)
    .offset(offset);
  const page = offsetPage(rows, query.limit, offset);
  return { items: page.items.map(toAssignment), nextCursor: page.nextCursor };
}

/**
 * Gives a person a role. With `replacesAssignmentId` the previous holder loses the role in the
 * same transaction, so the venue or city is never without a coordinator and never has two by
 * accident. Both changes are audited; the old assignment stays as history.
 */
export async function assignRole(
  db: Db,
  now: Date,
  actorId: string,
  target: RoleTarget,
  body: AssignRoleBody,
): Promise<StaffRoleAssignment> {
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, body.userId));
  if (!user) fail('not_found');
  const replacesId = 'replacesAssignmentId' in body ? body.replacesAssignmentId : undefined;

  try {
    const newId = await db.transaction(async (tx) => {
      if (replacesId) {
        const [old] = await tx
          .select()
          .from(roleAssignments)
          .where(and(eq(roleAssignments.id, replacesId), sameTarget(roleAssignments, target)))
          .for('update');
        // Unknown, revoked or at another place reads as not found, like an id out of scope.
        if (!old || old.revokedAt) return fail('not_found');
        if (old.userId === body.userId) return invalid('replacesAssignmentId');
        await tx
          .update(roleAssignments)
          .set({ revokedAt: now })
          .where(eq(roleAssignments.id, old.id));
        await writeAudit(tx, {
          actorUserId: actorId,
          action: 'role.revoke',
          entityType: 'role_assignment',
          entityId: old.id,
          scope: target.audit,
          meta: { role: target.role, reason: 'handover' },
        });
      }
      const [row] = await tx
        .insert(roleAssignments)
        .values({
          userId: body.userId,
          role: target.role,
          scopeType: target.scopeType,
          cityId: target.cityId,
          venueId: target.venueId,
          grantedBy: actorId,
          createdAt: now,
        })
        .returning({ id: roleAssignments.id });
      if (!row) throw new Error('role assignment insert returned no row');
      await writeAudit(tx, {
        actorUserId: actorId,
        action: 'role.assign',
        entityType: 'role_assignment',
        entityId: row.id,
        scope: target.audit,
        meta: { role: target.role, replacesAssignmentId: replacesId ?? null },
      });
      return row.id;
    });
    const created = await findAssignment(db, newId);
    if (!created) throw new Error('assignment vanished after insert');
    return toAssignment(created);
  } catch (error) {
    if (isUniqueViolation(error)) return fail('role_already_assigned');
    throw error;
  }
}

/** Revokes at once. Revoking something already revoked is a no-op. The last national admin stays. */
export async function revokeAssignment(
  db: Db,
  now: Date,
  actorId: string,
  assignment: typeof roleAssignments.$inferSelect,
  target: RoleTarget,
): Promise<void> {
  if (assignment.revokedAt) return;
  await db.transaction(async (tx) => {
    if (target.scopeType === 'national') {
      const live = await tx
        .select({ id: roleAssignments.id })
        .from(roleAssignments)
        .where(and(eq(roleAssignments.role, 'national_admin'), isNull(roleAssignments.revokedAt)))
        .for('update');
      if (live.length <= 1 && live.some((r) => r.id === assignment.id)) {
        return fail('last_national_admin');
      }
    }
    const [changed] = await tx
      .update(roleAssignments)
      .set({ revokedAt: now })
      .where(and(eq(roleAssignments.id, assignment.id), isNull(roleAssignments.revokedAt)))
      .returning({ id: roleAssignments.id });
    if (!changed) return;
    await writeAudit(tx, {
      actorUserId: actorId,
      action: 'role.revoke',
      entityType: 'role_assignment',
      entityId: assignment.id,
      scope: target.audit,
      meta: { role: assignment.role },
    });
  });
}
