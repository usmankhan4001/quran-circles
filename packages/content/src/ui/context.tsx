import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import type { ContentServices } from './services';

export interface ContentContextValue {
  services: ContentServices;
  /** `hijriOffsetDays` from `config.get`: days to add to the calculated Hijri date (-2 to 2). */
  hijriOffsetDays: number;
  /** True while a person is signed in, so bookmarks sync and the "saved on this phone" note hides. */
  signedIn: boolean;
}

const ContentContext = createContext<ContentContextValue | null>(null);

export interface ContentProviderProps {
  services: ContentServices;
  hijriOffsetDays?: number;
  signedIn?: boolean;
  children: ReactNode;
}

/**
 * Gives the Quran and prayer screens their services. It also brings the device and the account
 * in line when a person signs in (bookmarks and the reading position), and forgets the account's
 * copy when they sign out.
 */
export function ContentProvider({
  services,
  hijriOffsetDays = 0,
  signedIn = false,
  children,
}: ContentProviderProps) {
  useEffect(() => {
    if (signedIn) {
      void services.bookmarks.sync().catch(() => undefined);
      void services.readingPosition.sync().catch(() => undefined);
    }
  }, [services, signedIn]);

  const value = useMemo(
    () => ({ services, hijriOffsetDays, signedIn }),
    [services, hijriOffsetDays, signedIn],
  );
  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}

export function useContent(): ContentContextValue {
  const value = useContext(ContentContext);
  if (!value) throw new Error('useContent needs a <ContentProvider> above it.');
  return value;
}
