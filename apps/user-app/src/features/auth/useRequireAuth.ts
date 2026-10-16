import { useCallback } from 'react';
import { useNav } from '../../nav/NavProvider';
import type { Route } from '../../nav/routes';
import { useAuthState } from '../../providers/hooks';

/**
 * Browsing needs no account; registering, following and My Journey do. Call the returned
 * function before such an action: it returns true when signed in, and otherwise opens sign-in
 * with a way back to `returnTo`.
 */
export function useRequireAuth(): (returnTo: Route) => boolean {
  const { status } = useAuthState();
  const nav = useNav();
  return useCallback(
    (returnTo: Route) => {
      if (status === 'signedIn') return true;
      nav.go({ name: 'signIn', returnTo });
      return false;
    },
    [status, nav],
  );
}
