import { useMemo, useSyncExternalStore } from 'react';
import type { AuthState, AuthStatus } from '../auth/session';
import type { Preferences } from '../core/preferences';
import { useServices } from './services';

export function useAuthState(): AuthState {
  const { auth } = useServices();
  return useSyncExternalStore(auth.subscribe, auth.getState, auth.getState);
}

/**
 * Whether someone is signed in, and nothing else: a component that needs only this does not
 * draw again when `me` arrives after start-up.
 */
export function useAuthStatus(): AuthStatus {
  const { auth } = useServices();
  const read = () => auth.getState().status;
  return useSyncExternalStore(auth.subscribe, read, read);
}

export function usePreferences(): Preferences & {
  update: (change: Partial<Preferences>) => Promise<void>;
} {
  const { preferences } = useServices();
  const prefs = useSyncExternalStore(preferences.subscribe, preferences.get, preferences.get);
  return useMemo(
    () => ({ ...prefs, update: (change) => preferences.update(change) }),
    [prefs, preferences],
  );
}

export function useOffline(): boolean {
  const { connectivity } = useServices();
  return useSyncExternalStore(
    connectivity.subscribe,
    connectivity.isOffline,
    connectivity.isOffline,
  );
}

export function useReminderOptIns(): ReadonlySet<string> {
  const { reminders } = useServices();
  return useSyncExternalStore(reminders.subscribe, reminders.getOptedIn, reminders.getOptedIn);
}
