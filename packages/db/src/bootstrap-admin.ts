import { and, eq, gt, isNull, lte } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { E164_PATTERN, EMAIL_PATTERN } from '@qc/contracts';
import * as schema from './schema/index';

/**
 * The first national admin on a fresh database (integration finding F-01).
 *
 * Nobody can be given a role through the API without an existing staff caller, and the seed
 * writes no people. This creates the same pending national-admin invite that `adminRoles.invite`
 * creates, so the person signs in with a code as usual and the sign-in turns the invite into the
 * role. Like the API it retires a lapsed invite for the number, replaces a live one (a resend),
 * and writes a `role.invite` audit row in the same transaction. The audit row has no actor
 * (nobody is signed in) and records `source: 'bootstrap-admin'`. No WhatsApp invitation is
 * queued: whoever runs the command tells the person to sign in.
 *
 * Refusals:
 * - an active national admin already exists (a live assignment held by an active account), unless
 *   `forceAdditional` is set; the normal way to add admins is the console;
 * - APP_ENV or NODE_ENV is "production", unless `confirmProduction` is set (`--yes`);
 * - the number already holds the national admin role, or is not E.164.
 *
 * The phone number is never returned, printed or written to the audit row.
 */

export type BootstrapDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;

/** The API's invite lifetime (`inviteTtlDays` in apps/api). */
export const BOOTSTRAP_INVITE_TTL_DAYS = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type BootstrapRefusal =
  'invalid_phone' | 'invalid_email' | 'production' | 'admin_exists' | 'already_admin' | 'conflict';

/** Thrown for every refusal; nothing is written when it is thrown. */
export class BootstrapRefusedError extends Error {
  constructor(
    readonly reason: BootstrapRefusal,
    message: string,
  ) {
    super(message);
    this.name = 'BootstrapRefusedError';
  }
}

export interface BootstrapOptions {
  /** E.164 number of the person to invite. */
  phone: string;
  /**
   * The address the person signs in with. The invite is accepted by this verified address; leave
   * it out only when WhatsApp sign-in is on, where the verified number accepts it.
   */
  email?: string;
  /** Add another national admin even though an active one exists. */
  forceAdditional?: boolean;
  /** Required when the environment is production. */
  confirmProduction?: boolean;
  /** Environment to check for production. Defaults to `process.env`. */
  env?: Readonly<Record<string, string | undefined>>;
  /** Clock, for tests. Defaults to now. */
  now?: Date;
  ttlDays?: number;
}

export interface BootstrapResult {
  inviteId: string;
  expiresAt: Date;
  /** The pending invite this one replaced (a second run for the same number), if any. */
  replacedInviteId: string | null;
}

/**
 * Throws unless the environment allows a bootstrap: in production (APP_ENV or NODE_ENV) only with
 * `confirmProduction`. The CLI calls this before it connects.
 */
export function assertBootstrapAllowed(
  env: Readonly<Record<string, string | undefined>> = process.env,
  confirmProduction = false,
): void {
  if (confirmProduction) return;
  for (const variable of ['APP_ENV', 'NODE_ENV']) {
    if (env[variable]?.trim().toLowerCase() === 'production') {
      throw new BootstrapRefusedError(
        'production',
        `${variable} is "production". Pass --yes to create the invite there.`,
      );
    }
  }
}

const { coordinatorInvites, roleAssignments, users, auditLog } = schema;

const nationalAdmin = and(
  eq(coordinatorInvites.role, 'national_admin'),
  isNull(coordinatorInvites.cityId),
  isNull(coordinatorInvites.venueId),
);

/** Creates the pending national-admin invite. Throws `BootstrapRefusedError` on every refusal. */
export async function bootstrapNationalAdmin(
  db: BootstrapDatabase,
  options: BootstrapOptions,
): Promise<BootstrapResult> {
  const phone = options.phone.trim();
  if (!E164_PATTERN.test(phone)) {
    throw new BootstrapRefusedError(
      'invalid_phone',
      'The phone number must be in E.164 form, for example +923000000001.',
    );
  }
  const email = options.email?.trim().toLowerCase();
  if (email !== undefined && !EMAIL_PATTERN.test(email)) {
    throw new BootstrapRefusedError('invalid_email', 'The email address is not valid.');
  }
  assertBootstrapAllowed(options.env ?? process.env, options.confirmProduction === true);
  const now = options.now ?? new Date();
  const ttlDays = options.ttlDays ?? BOOTSTRAP_INVITE_TTL_DAYS;

  try {
    return await db.transaction(async (tx) => {
      const holders = await tx
        .select({ userId: roleAssignments.userId, phone: users.phoneE164 })
        .from(roleAssignments)
        .innerJoin(users, eq(users.id, roleAssignments.userId))
        .where(
          and(
            eq(roleAssignments.role, 'national_admin'),
            isNull(roleAssignments.revokedAt),
            eq(users.status, 'active'),
          ),
        );
      if (holders.some((h) => h.phone === phone)) {
        throw new BootstrapRefusedError(
          'already_admin',
          'This number already holds the national admin role.',
        );
      }
      if (holders.length > 0 && !options.forceAdditional) {
        throw new BootstrapRefusedError(
          'admin_exists',
          'An active national admin already exists. Invite more admins from the console, or pass --force-additional.',
        );
      }

      // A lapsed invite still counts as pending to the unique index; retire it first.
      await tx
        .update(coordinatorInvites)
        .set({ status: 'expired' })
        .where(
          and(
            eq(coordinatorInvites.phoneE164, phone),
            nationalAdmin,
            eq(coordinatorInvites.status, 'pending'),
            lte(coordinatorInvites.expiresAt, now),
          ),
        );
      // A live one gives way to the new invite, as a resend through the API does.
      const [previous] = await tx
        .update(coordinatorInvites)
        .set({ status: 'revoked' })
        .where(
          and(
            eq(coordinatorInvites.phoneE164, phone),
            nationalAdmin,
            eq(coordinatorInvites.status, 'pending'),
            gt(coordinatorInvites.expiresAt, now),
          ),
        )
        .returning({ id: coordinatorInvites.id });

      const [row] = await tx
        .insert(coordinatorInvites)
        .values({
          phoneE164: phone,
          email: email ?? null,
          displayName: null,
          role: 'national_admin',
          scopeType: 'national',
          cityId: null,
          venueId: null,
          invitedBy: null,
          replacesAssignmentId: null,
          status: 'pending',
          createdAt: now,
          expiresAt: new Date(now.getTime() + ttlDays * MS_PER_DAY),
        })
        .returning({ id: coordinatorInvites.id, expiresAt: coordinatorInvites.expiresAt });
      if (!row) throw new Error('invite insert returned no row');

      // The same row `writeAudit` in apps/api writes for `adminRoles.invite`, with no actor.
      await tx.insert(auditLog).values({
        actorUserId: null,
        action: 'role.invite',
        entityType: 'invite',
        entityId: row.id,
        scopeType: 'national',
        cityId: null,
        venueId: null,
        meta: {
          role: 'national_admin',
          replacesInviteId: previous?.id ?? null,
          replacesAssignmentId: null,
          source: 'bootstrap-admin',
          forceAdditional: options.forceAdditional === true,
        },
        createdAt: now,
      });

      return { inviteId: row.id, expiresAt: row.expiresAt, replacedInviteId: previous?.id ?? null };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new BootstrapRefusedError(
        'conflict',
        'Another invite for this number was created at the same time. Run the command again.',
      );
    }
    throw error;
  }
}

function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && typeof current === 'object' && current !== null; depth++) {
    if ((current as { code?: unknown }).code === '23505') return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

export interface BootstrapArgs {
  phone: string;
  email?: string;
  forceAdditional: boolean;
  yes: boolean;
}

const USAGE =
  'Usage: bootstrap-admin --phone <E.164> [--email <address>] [--force-additional] [--yes]';

/** Parses `--phone N` / `--phone=N`, `--email A`, `--force-additional` and `--yes`. Throws with a usage line. */
export function parseBootstrapArgs(argv: readonly string[]): BootstrapArgs {
  let phone: string | undefined;
  let email: string | undefined;
  let forceAdditional = false;
  let yes = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--') continue;
    if (arg === '--force-additional') forceAdditional = true;
    else if (arg === '--yes' || arg === '-y') yes = true;
    else if (arg === '--phone' || arg.startsWith('--phone=')) {
      phone = arg.includes('=') ? arg.slice(arg.indexOf('=') + 1) : argv[++i];
      if (!phone) throw new Error(`--phone needs a number. ${USAGE}`);
    } else if (arg === '--email' || arg.startsWith('--email=')) {
      email = arg.includes('=') ? arg.slice(arg.indexOf('=') + 1) : argv[++i];
      if (!email) throw new Error(`--email needs an address. ${USAGE}`);
    } else {
      // Never echo the argument: it may be a phone number typed in the wrong place.
      throw new Error(`Unknown argument. ${USAGE}`);
    }
  }
  if (!phone) throw new Error(`--phone is required. ${USAGE}`);
  return { phone, ...(email ? { email } : {}), forceAdditional, yes };
}
