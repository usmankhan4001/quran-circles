import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Principal } from '@qc/contracts';
import { useMe } from '../auth/AuthProvider';
import type { KeyValueStore } from '../storage/storage';
import {
  listFilterOf,
  pickWorkingScope,
  principalOf,
  workingScopesOf,
  type WorkingScope,
} from './principal';

export const WORKING_SCOPE_KEY = 'qc.admin.workingScope';

interface WorkingScopeValue {
  scopes: WorkingScope[];
  active: WorkingScope | null;
  setActive: (id: string) => void;
  principal: Principal;
  /** Narrows list calls to the working scope. */
  filter: { cityId?: string; venueId?: string };
}

const WorkingScopeContext = createContext<WorkingScopeValue | null>(null);

/**
 * Which of the person's roles they are working as. Someone who coordinates two venues, or a
 * venue and a city, switches here; lists and defaults follow. The choice is remembered on the
 * device. Authorisation never depends on it: the server checks every request against all roles.
 */
export function WorkingScopeProvider({
  store,
  children,
}: {
  store: KeyValueStore;
  children: ReactNode;
}) {
  const me = useMe();
  const scopes = useMemo(() => workingScopesOf(me), [me]);
  const principal = useMemo(() => principalOf(me), [me]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void store.get(WORKING_SCOPE_KEY).then((saved) => {
      if (cancelled) return;
      setActiveId(saved);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [store]);

  const active = useMemo(() => pickWorkingScope(scopes, activeId), [scopes, activeId]);
  const setActive = useCallback(
    (id: string) => {
      setActiveId(id);
      void store.set(WORKING_SCOPE_KEY, id);
    },
    [store],
  );

  const value = useMemo<WorkingScopeValue>(
    () => ({ scopes, active, setActive, principal, filter: listFilterOf(active) }),
    [scopes, active, setActive, principal],
  );
  if (!loaded) return null;
  return <WorkingScopeContext.Provider value={value}>{children}</WorkingScopeContext.Provider>;
}

export function useWorkingScope(): WorkingScopeValue {
  const value = useContext(WorkingScopeContext);
  if (!value) throw new Error('useWorkingScope must be used inside WorkingScopeProvider');
  return value;
}
