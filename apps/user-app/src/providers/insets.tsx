import { createContext, useContext, type ReactNode } from 'react';

export interface Insets {
  top: number;
  bottom: number;
  start: number;
  end: number;
}

const zero: Insets = { top: 0, bottom: 0, start: 0, end: 0 };
const InsetsContext = createContext<Insets>(zero);

/** Space taken by notches and system bars. The root layout feeds it from the phone; tests use zero. */
export function InsetsProvider({ insets, children }: { insets: Insets; children: ReactNode }) {
  return <InsetsContext.Provider value={insets}>{children}</InsetsContext.Provider>;
}

export function useInsets(): Insets {
  return useContext(InsetsContext);
}
