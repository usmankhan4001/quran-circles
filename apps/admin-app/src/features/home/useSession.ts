import type { AdminSession } from '@qc/contracts';
import { isNotAvailable } from '../../api/errors';
import { useQuery, type QueryResult } from '../../api/query';
import { useApi } from '../../auth/AuthProvider';

/**
 * One session in the person's scope, drafts included, from `adminSessions.get`. A session outside
 * the scope answers `not_found`, the same as one that does not exist; screens show that as "not
 * available to you" (`sessionNotAvailable`).
 */
export function useSession(sessionId: string, reloadKey = 0): QueryResult<AdminSession> {
  const api = useApi();
  return useQuery(() => api.adminSessions.get({ params: { sessionId } }), [sessionId, reloadKey]);
}

/** True when the session could not be read because it is not in the person's scope (or gone). */
export function sessionNotAvailable(query: QueryResult<AdminSession>): boolean {
  return query.status === 'error' && isNotAvailable(query.error);
}
