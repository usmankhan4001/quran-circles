import { and, eq, gt } from 'drizzle-orm';
import {
  BootstrapRefusedError,
  bootstrapNationalAdmin,
  schema,
  type BootstrapDatabase,
} from '@qc/db';
import type { CodeMessage, CodeSender } from './code-sender';
import type { FirstAdmin } from './config';
import type { AuthLogger } from './types';

const { coordinatorInvites, roleAssignments, users } = schema;

/**
 * Delivers the first admin's sign-in codes to `codeTo` instead of the sign-in address. Only that
 * one identity, matched case-insensitively, is redirected; every other message passes through
 * unchanged. The redirect happens at delivery only: the challenge, its cooldown and every rate
 * limit are keyed on the sign-in address as before.
 */
export function redirectingCodeSender(inner: CodeSender, admin: FirstAdmin | null): CodeSender {
  if (!admin?.codeTo) return inner;
  const { email, codeTo } = admin;
  return {
    send(message: CodeMessage) {
      const redirect = message.email !== undefined && message.email.toLowerCase() === email;
      return inner.send(redirect ? { ...message, email: codeTo } : message);
    },
  };
}

export type FirstAdminOutcome = 'not_configured' | 'admin_exists' | 'invite_pending' | 'invited';

/**
 * Makes sure the configured first admin can sign in: when no active national admin exists and no
 * live invite is waiting for that address, it creates the same pending invite `bootstrap-admin`
 * does (the sign-in by that address then turns it into the role). Safe to run at every start of
 * every API process: it writes nothing when there is nothing to do, and a refusal from the
 * bootstrap (another process got there first, the number already holds the role) is logged, not
 * thrown. Nothing here can stop the server from starting.
 */
export async function ensureFirstAdmin(
  db: BootstrapDatabase,
  admin: FirstAdmin | null,
  logger: AuthLogger,
  now: Date = new Date(),
): Promise<FirstAdminOutcome> {
  if (!admin) return 'not_configured';
  const [holder] = await db
    .select({ userId: roleAssignments.userId })
    .from(roleAssignments)
    .innerJoin(users, eq(users.id, roleAssignments.userId))
    .where(
      and(
        eq(roleAssignments.role, 'national_admin'),
        eq(users.status, 'active'),
        eq(roleAssignments.revokedAt, null as never),
      ),
    )
    .limit(1);
  if (holder) return 'admin_exists';

  const [pending] = await db
    .select({ id: coordinatorInvites.id })
    .from(coordinatorInvites)
    .where(
      and(
        eq(coordinatorInvites.email, admin.email),
        eq(coordinatorInvites.role, 'national_admin'),
        eq(coordinatorInvites.status, 'pending'),
        gt(coordinatorInvites.expiresAt, now),
      ),
    )
    .limit(1);
  if (pending) return 'invite_pending';

  try {
    const result = await bootstrapNationalAdmin(db, {
      phone: admin.phone,
      email: admin.email,
      confirmProduction: true,
      now,
    });
    logger.info('auth.first_admin_invited', { inviteId: result.inviteId });
    return 'invited';
  } catch (error) {
    if (error instanceof BootstrapRefusedError) {
      logger.warn('auth.first_admin_not_invited', { reason: error.reason });
      return error.reason === 'conflict' ? 'invite_pending' : 'admin_exists';
    }
    logger.error('auth.first_admin_failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return 'not_configured';
  }
}
