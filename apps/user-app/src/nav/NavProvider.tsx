import { createContext, useContext, type ReactNode } from 'react';
import type { Route } from './routes';

export interface Navigator {
  /** Opens a screen on top of the current one. */
  go(route: Route): void;
  /** Replaces the current screen (after sign-in, after registering). */
  replace(route: Route): void;
  back(): void;
  /** Switches to a tab and clears what is above it. */
  tab(route: Extract<Route, { name: 'home' | 'nearby' | 'journey' | 'quran' }>): void;
}

const NavContext = createContext<Navigator | null>(null);

export function NavProvider({ navigator, children }: { navigator: Navigator; children: ReactNode }) {
  return <NavContext.Provider value={navigator}>{children}</NavContext.Provider>;
}

export function useNav(): Navigator {
  const nav = useContext(NavContext);
  if (!nav) throw new Error('useNav needs a NavProvider');
  return nav;
}
