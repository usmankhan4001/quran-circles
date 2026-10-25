import { and, asc, eq, gt, isNull, lte, ne } from 'drizzle-orm';
import { schema } from '@qc/db';
import type { AuthContext } from '../../auth/context';
import type { AuthDb } from '../../auth/types';

const { coordinatorInvites, roleAssignments, auditLog, venues } = schema;

type Tx = Pick<AuthDb, 'insert' | 'update' | 'select'>;

/**
 * Marks this number's lapsed pending invites as expired. Returns how many it changed and whether
 * a live pending invite is left, so the caller can tell "your invitation has expired" from
 * "nothing was ever pending".
 */
export async function expireLapsedInvites(
  ctx: AuthContext,
  phone: string,
  now: Date,
): Promise<{ expired: number; livePending: number }> {
  const expired = await ctx.db
    .update(coordinatorInvites)
    .set({ status: 'expired' })
    .where(
      and(
        eq(coordinatorInvites.phoneE164, phone),
        eq(coordinatorInvites.status, 'pending'),
        lte(coordinatorInvites.expiresAt, now),
      ),
    )
    .returning({ id: coordinatorInvites.id });
  const live = await ctx.db
    .select({ id: coordinatorInvites.id })
    .from(coordinatorInvites)
    .where(
      and(
        eq(coordinatorInvites.phoneE164, phone),
        eq(coordinatorInvites.status, 'pending'),
        gt(coordinatorInvites.expiresAt, now),
      ),
    );
  return { expired: expired.length, livePending: live.length };
}

export interface AcceptedInvites {
  /** The name the inviting admin gave, if any, to use for a brand-new account. */
  displayName: string | null;
  accepted: number;
}

/**
 * Turns this number's live pending invites into role assignments and marks them accepted, with an
 * audit row each. Runs inside the sign-in transaction, so either the account, the roles and the
 * session all exist, or none do. Claiming an invite is an update that only matches while it is
 * still pending, so two sign-ins at once cannot accept it twice.
 *
 * A handover invite (`replaces_assignment_id`) already ended the assignment it replaces when it was
 * created (SEC-22), so normally there is nothing left to end here. An invite created before that
 * change can still point at a live assignment; accepting it revokes that one in the same transaction,
 * with its own audit row, so the place never has two coordinators by accident. The replaced
 * assignment must still be live and be the same role at the same place.
 */
export async function acceptInvites(
  tx: Tx,
  input: { userId: string; phone: string; now: Date },
): Promise<AcceptedInvites> {
  const pending = await tx
    .select()
    .from(coordinatorInvites)
    .where(
      and(
        eq(coordinatorInvites.phoneE164, input.phone),
        eq(coordinatorInvites.status, 'pending'),
        gt(coordinatorInvites.expiresAt, input.now),
      ),
    )
    .orderBy(asc(coordinatorInvites.createdAt), asc(coordinatorInvites.id));

  let accepted = 0;
  let displayName: string | null = null;
  for (const invite of pending) {
    const [claimed] = await tx
      .update(coordinatorInvites)
      .set({ status: 'accepted', acceptedBy: input.userId, acceptedAt: input.now })
      .where(and(eq(coordinatorInvites.id, invite.id), eq(coordinatorInvites.status, 'pending')))
      .returning({ id: coordinatorInvites.id });
    if (!claimed) continue;
    accepted += 1;
    displayName ??= invite.displayName;

    // The person may already hold this exact role (assigned directly); then there is nothing to add.
    const [assignment] = await tx
      .insert(roleAssignments)
      .values({
        userId: input.userId,
        role: invite.role,
        scopeType: invite.scopeType,
        cityId: invite.cityId,
        venueId: invite.venueId,
        grantedBy: invite.invitedBy,
        createdAt: input.now,
      })
      .onConflictDoNothing()
      .returning({ id: roleAssignments.id });

    // Audit rows carry the city so city coordinators can read the log for their own city.
    let cityId = invite.cityId;
    if (!cityId && invite.venueId) {
      const [venue] = await tx
        .select({ cityId: venues.cityId })
        .from(venues)
        .where(eq(venues.id, invite.venueId))
        .limit(1);
      cityId = venue?.cityId ?? null;
    }

    if (invite.replacesAssignmentId) {
      const [ended] = await tx
        .update(roleAssignments)
        .set({ revokedAt: input.now })
        .where(
          and(
            eq(roleAssignments.id, invite.replacesAssignmentId),
            isNull(roleAssignments.revokedAt),
            // Handing a place to the person who already holds it changes nothing.
            ne(roleAssignments.userId, input.userId),
            eq(roleAssignments.role, invite.role),
            invite.cityId
              ? eq(roleAssignments.cityId, invite.cityId)
              : isNull(roleAssignments.cityId),
            invite.venueId
              ? eq(roleAssignments.venueId, invite.venueId)
              : isNull(roleAssignments.venueId),
          ),
        )
        .returning({ id: roleAssignments.id, userId: roleAssignments.userId });
      if (ended) {
        await tx.insert(auditLog).values({
          actorUserId: invite.invitedBy ?? input.userId,
          action: 'role.revoke',
          entityType: 'role_assignment',
          entityId: ended.id,
          scopeType: invite.scopeType,
          cityId,
          venueId: invite.venueId,
          meta: { role: invite.role, reason: 'handover', inviteId: invite.id },
          createdAt: input.now,
        });
      }
    }
    await tx.insert(auditLog).values({
      actorUserId: input.userId,
      action: 'role.accept_invite',
      entityType: 'role_assignment',
      entityId: assignment?.id ?? null,
      scopeType: invite.scopeType,
      cityId,
      venueId: invite.venueId,
      meta: { inviteId: invite.id, role: invite.role, assigned: assignment !== undefined },
      createdAt: input.now,
    });
  }
  return { displayName, accepted };
}
