import { topUpAllOccurrences, type TopUpSummary } from '@qc/db';
import type { Logger } from '@qc/messaging';
import type { Clock, Db } from '../db';

export interface TopUpDeps {
  db: Db;
  logger: Logger;
  now: Clock;
  /** How many days ahead to keep occurrences. */
  horizonDays: number;
}

/**
 * The daily occurrence top-up: keeps every live recurring session's dates filled `horizonDays`
 * ahead, so reminders keep being built for sessions nobody opens. The job only adds dates after
 * the latest existing one, so running it twice (or on two nodes) adds nothing the second time.
 * Logs counts only.
 */
export async function runOccurrenceTopUp(deps: TopUpDeps): Promise<TopUpSummary> {
  const summary = await topUpAllOccurrences(deps.db, deps.now(), deps.horizonDays);
  deps.logger.info('occurrences.topped_up', {
    sessions: summary.sessions,
    occurrencesAdded: summary.occurrencesAdded,
    horizonDays: deps.horizonDays,
  });
  return summary;
}
