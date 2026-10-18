import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router';

/**
 * The top bar's city pills and search pill, as drawn on the console artboards: one city choice and
 * one search for the page on screen. A page that lists rows by city reads the city here, and a page
 * that searches its loaded rows names its search (the label people see as the placeholder). The
 * search empties when the page changes; the city stays, as it does across the artboards.
 */
interface ShellFilters {
  cityId: string;
  setCityId(id: string): void;
  query: string;
  setQuery(q: string): void;
  searchLabel: string | null;
  setSearchLabel(label: string | null): void;
}

const ShellFiltersContext = createContext<ShellFilters | null>(null);

export function ShellFiltersProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [cityId, setCityId] = useState('');
  const [query, setQuery] = useState('');
  const [searchLabel, setSearchLabel] = useState<string | null>(null);

  useEffect(() => {
    setQuery('');
  }, [pathname]);

  const value = useMemo(
    () => ({ cityId, setCityId, query, setQuery, searchLabel, setSearchLabel }),
    [cityId, query, searchLabel],
  );
  return <ShellFiltersContext.Provider value={value}>{children}</ShellFiltersContext.Provider>;
}

/** The shell's filters, or a local stand-in when a page is drawn without the shell. */
function useFilters(): ShellFilters {
  const ctx = useContext(ShellFiltersContext);
  const [cityId, setCityId] = useState('');
  const [query, setQuery] = useState('');
  return ctx ?? { cityId, setCityId, query, setQuery, searchLabel: null, setSearchLabel: () => {} };
}

export function useShellFilters(): ShellFilters | null {
  return useContext(ShellFiltersContext);
}

/** The city chosen in the top bar ('' is every city). */
export function useShellCity(): [string, (id: string) => void] {
  const f = useFilters();
  return [f.cityId, f.setCityId];
}

/** Shows the top bar's search pill with `label` while the page is on screen. */
export function useShellSearch(label: string): [string, (q: string) => void] {
  const f = useFilters();
  const { setSearchLabel } = f;
  useEffect(() => {
    setSearchLabel(label);
    return () => setSearchLabel(null);
  }, [label, setSearchLabel]);
  return [f.query, f.setQuery];
}
