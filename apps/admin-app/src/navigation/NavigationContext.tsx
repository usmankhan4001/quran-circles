import { createContext, useContext } from 'react';

/**
 * How a screen moves. The app wires this to Expo Router; tests wire it to a recorder. Screens
 * never import the router themselves, so they can be rendered and tested without one.
 */
export interface Navigation {
  push: (href: string) => void;
  replace: (href: string) => void;
  back: () => void;
}

const noop: Navigation = { push: () => undefined, replace: () => undefined, back: () => undefined };

export const NavigationContext = createContext<Navigation>(noop);

export const useNavigation = (): Navigation => useContext(NavigationContext);
