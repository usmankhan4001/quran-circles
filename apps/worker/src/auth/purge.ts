import { purgeStaleAuthRows, type PurgeResult } from '@qc/db';
import type { Logger } from '@qc/messaging';
import type { Clock, Db } from '../db';

export interface AuthPurgeDeps {
  db: Db;
  logger: Logger;
  now: Clock;
}

/**
 * The daily sign-in purge: removes codes more than a day past expiry and sessions that expired or
 * were revoked more than 30 days ago (`purgeStaleAuthRows` in `@qc/db`). Live sessions stay. A
 * second run removes nothing more. Logs one line with counts only.
 */
export async function runAuthPurge(deps: AuthPurgeDeps): Promise<PurgeResult> {
  const result = await purgeStaleAuthRows(deps.db, deps.now());
  deps.logger.info('auth.purged', { challenges: result.challenges, sessions: result.sessions });
  return result;
}
