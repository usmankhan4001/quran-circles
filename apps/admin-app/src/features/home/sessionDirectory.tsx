import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from 'react';
import type { Session } from '@qc/contracts';
import { isErrorCode } from '../../api/errors';
import { useQuery, type QueryResult } from '../../api/query';
import { useApi } from '../../auth/AuthProvider';

interface Directory {
  remember: (sessions: readonly Session[]) => void;
  get: (id: string) => Session | undefined;
}

const DirectoryContext = createContext<Directory | null>(null);

/**
 * Remembers the sessions the lists have already loaded. The contract has no admin call for one
 * session, and a draft is not on the public call, so a screen opened from a list reads from here
 * when the public call cannot find the session. See the change request for `adminSessions.get`.
 */
export function SessionDirectoryProvider({ children }: { children: ReactNode }) {
  const map = useRef(new Map<string, Session>());
  const remember = useCallback((sessions: readonly Session[]) => {
    for (const s of sessions) map.current.set(s.id, s);
  }, []);
  const get = useCallback((id: string) => map.current.get(id), []);
  const value = useMemo(() => ({ remember, get }), [remember, get]);
  return <DirectoryContext.Provider value={value}>{children}</DirectoryContext.Provider>;
}

export function useSessionDirectory(): Directory {
  const dir = useContext(DirectoryContext);
  if (!dir) throw new Error('useSessionDirectory must be used inside SessionDirectoryProvider');
  return dir;
}

/** One session, fresh from the API, or from the list it was opened from when it is a draft. */
export function useSession(sessionId: string, reloadKey = 0): QueryResult<Session> {
  const api = useApi();
  const dir = useSessionDirectory();
  return useQuery(async () => {
    try {
      const session = await api.sessions.get({ params: { sessionId } });
      dir.remember([session]);
      return session;
    } catch (error) {
      const cached = dir.get(sessionId);
      if (cached && isErrorCode(error, 'not_found')) return cached;
      throw error;
    }
  }, [sessionId, reloadKey]);
}
