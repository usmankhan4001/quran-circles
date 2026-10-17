import { and, eq, gte, inArray, isNull, or } from 'drizzle-orm';
import { schema, type Db } from '../../db';
import { compareDates, utcToLocalDate, DEFAULT_TIMEZONE } from '../shared/time';
import { topUpOccurrences } from './occurrences';
import { specOf } from './public';

const { sessions, seasons } = schema;

export interface TopUpSummary {
  sessions: number;
  occurrencesAdded: number;
}

/**
 * Keeps every live recurring session's occurrences filled up to the horizon. Meant for a daily
 * job: the public occurrences view also tops up one session lazily, but a session nobody opens
 * would otherwise run dry, and reminders are built from occurrences. A session in a season stops
 * at the season's last day. Safe to run at any time and as often as wanted.
 */
export async function topUpAllOccurrences(
  db: Db,
  now: Date,
  horizonDays: number,
): Promise<TopUpSummary> {
  // Sessions that ended before today (in the widest sense) have nothing left to add.
  const today = utcToLocalDate(now, DEFAULT_TIMEZONE);
  const rows = await db
    .select({ s: sessions, seasonEndsOn: seasons.endsOn })
    .from(sessions)
    .leftJoin(seasons, eq(seasons.id, sessions.seasonId))
    .where(
      and(
        eq(sessions.kind, 'recurring'),
        inArray(sessions.status, ['draft', 'published']),
        or(isNull(sessions.endsOn), gte(sessions.endsOn, today)),
      ),
    );
  let occurrencesAdded = 0;
  for (const { s, seasonEndsOn } of rows) {
    const spec = specOf(s);
    if (seasonEndsOn && (!spec.endsOn || compareDates(seasonEndsOn, spec.endsOn) < 0)) {
      spec.endsOn = seasonEndsOn;
    }
    occurrencesAdded += await topUpOccurrences(db, s.id, spec, now, horizonDays);
  }
  return { sessions: rows.length, occurrencesAdded };
}
