import type { ReactNode } from 'react';
import type { Locale, Me, Tokens } from '@qc/contracts';
import {
  AppearanceProvider,
  useAppearance,
  type Appearance,
} from '../appearance/AppearanceProvider';
import { AuthProvider } from '../auth/AuthProvider';
import type { KeyValueStore } from '../storage/storage';

export interface AppProvidersProps {
  baseUrl: string;
  /** Sign-in tokens. On a phone this is the secure keychain. */
  tokenStore: KeyValueStore;
  /** Language, text size, colour and working scope. Not secret. */
  prefsStore: KeyValueStore;
  /** Defaults to the global fetch; tests pass the contract's mock handler. */
  fetch?: typeof fetch;
  initialSession?: { tokens: Tokens; me: Me };
  initialAppearance?: Partial<Appearance>;
  children: ReactNode;
}

function WithAuth({
  baseUrl,
  tokenStore,
  fetch,
  initialSession,
  children,
}: Pick<AppProvidersProps, 'baseUrl' | 'tokenStore' | 'fetch' | 'initialSession' | 'children'>) {
  const { locale } = useAppearance();
  // The server writes messages (such as error text for logs) in the person's language.
  const getLocale = (): Locale => locale;
  return (
    <AuthProvider
      baseUrl={baseUrl}
      tokenStore={tokenStore}
      fetch={fetch}
      getLocale={getLocale}
      initialSession={initialSession}
    >
      {children}
    </AuthProvider>
  );
}

/** Appearance first (so every screen, even sign-in, has a theme), then the sign-in. */
export function AppProviders({
  baseUrl,
  tokenStore,
  prefsStore,
  fetch,
  initialSession,
  initialAppearance,
  children,
}: AppProvidersProps) {
  return (
    <AppearanceProvider store={prefsStore} initial={initialAppearance}>
      <WithAuth
        baseUrl={baseUrl}
        tokenStore={tokenStore}
        fetch={fetch}
        initialSession={initialSession}
      >
        {children}
      </WithAuth>
    </AppearanceProvider>
  );
}
