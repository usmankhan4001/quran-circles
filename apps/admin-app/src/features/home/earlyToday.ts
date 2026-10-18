import { createApiClient, Me, type Locale, type Session } from '@qc/contracts';
import type { EarlyMeAnswer } from '../../auth/earlyMe';
import { isStaff, listFilterOf, pickWorkingScope, workingScopesOf } from '../../scope/principal';

/** How many sessions Today asks for (`TodayScreen`). */
export const TODAY_LIMIT = 50;

/** An early answer older than this is not used: Today asks again. */
export const EARLY_TODAY_MAX_AGE_MS = 60_000;

type Filter = { cityId?: string; venueId?: string };

interface Early {
  userId: string;
  filter: string;
  startedAt: number;
  sessions: Promise<Session[]>;
}

let early: Early | null = null;

const keyOf = (filter: Filter): string => `${filter.cityId ?? ''}|${filter.venueId ?? ''}`;

export interface EarlyTodayOptions {
  baseUrl: string;
  /** The early `me` answer (`peekEarlyMe`), or null when none was asked. */
  me: EarlyMeAnswer | null;
  /** The saved working scope (`WORKING_SCOPE_KEY`), read at start. */
  savedScopeId: string | null;
  locale: Locale;
  fetch?: typeof fetch;
  now?: () => number;
}

/**
 * Asks for Today's sessions as soon as the early `me` answer is in, instead of after the first
 * render: on a slow phone that is one round trip less before Today shows its sessions.
 *
 * Only for a signed-in staff member, and only once `me` checks out against the contract's `Me`
 * schema. The working scope is chosen exactly as `WorkingScopeProvider` will choose it (the
 * saved one if still held, else the narrowest), and the request is the one Today makes, through
 * the contract's client, which checks the answer too. Nothing is stored, refreshed or written:
 * an answer that fails is simply not used. `takeEarlyToday` hands it to Today only when the
 * person and the scope still match.
 */
export function startEarlyToday(options: EarlyTodayOptions): void {
  early = null;
  const answer = options.me;
  if (!answer) return;
  const now = options.now ?? Date.now;
  const startedAt = now();
  void answer.body
    .then((body) => {
      const checked = Me.safeParse(body);
      if (!checked.success || !isStaff(checked.data)) return;
      const me = checked.data;
      const filter = listFilterOf(pickWorkingScope(workingScopesOf(me), options.savedScopeId));
      const api = createApiClient({
        baseUrl: options.baseUrl,
        fetch: options.fetch,
        getAccessToken: () => answer.accessToken,
        getLocale: () => options.locale,
      });
      const sessions = api.adminSessions
        .list({ query: { ...filter, limit: TODAY_LIMIT } })
        .then((page) => page.items);
      // Today may never take it (another screen first, or the scope changed): no unhandled error.
      sessions.catch(() => undefined);
      early = { userId: me.id, filter: keyOf(filter), startedAt, sessions };
    })
    .catch(() => undefined);
}

/**
 * The early sessions, once, when they were asked for this person and this working-scope filter
 * within the last minute; otherwise null, and the early answer is dropped.
 */
export function takeEarlyToday(
  userId: string,
  filter: Filter,
  now: number = Date.now(),
): Promise<Session[]> | null {
  const pending = early;
  early = null;
  if (!pending) return null;
  if (pending.userId !== userId || pending.filter !== keyOf(filter)) return null;
  if (now - pending.startedAt > EARLY_TODAY_MAX_AGE_MS) return null;
  return pending.sessions;
}
