import pg from 'pg';
import { stack } from './env';

let pool: pg.Pool | null = null;

/**
 * Direct database access, for reads only: checking what the API and the worker wrote (the outbox,
 * an invite's state). National admins come from the `bootstrap-admin` command (see `people.ts`).
 * Flows themselves go through the API.
 */
export function db(): pg.Pool {
  pool ??= new pg.Pool({ connectionString: stack().databaseUrl, max: 2 });
  return pool;
}

export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = null;
}

export interface OutboxRow {
  id: string;
  idempotency_key: string;
  channel: 'push' | 'whatsapp' | 'sms';
  template_key: string | null;
  recipient_user_id: string | null;
  status: string;
  last_error_code: string | null;
  provider_message_id: string | null;
  update_id: string | null;
  venue_id: string | null;
  payload: Record<string, unknown>;
  next_attempt_at: Date;
  sent_at: Date | null;
}

export async function outboxFor(userId: string): Promise<OutboxRow[]> {
  const { rows } = await db().query<OutboxRow>(
    `select id, idempotency_key, channel, template_key, recipient_user_id, status, last_error_code,
            provider_message_id, update_id, venue_id, payload, next_attempt_at, sent_at
       from message_outbox where recipient_user_id = $1 order by created_at`,
    [userId],
  );
  return rows;
}
