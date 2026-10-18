import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  ApiClientError,
  createApiClient,
  Tokens,
  type ApiClient,
  Me,
  type Locale,
} from '@qc/contracts';
import { createAuthedFetch } from '../api/authedFetch';
import { takeEarlyMe } from './earlyMe';
import { TOKENS_KEY } from './keys';
import type { KeyValueStore } from '../storage/storage';

export type SignInResult = Awaited<ReturnType<ApiClient['auth']['verifyCode']>>;
export type AuthStatus = 'restoring' | 'signedOut' | 'signedIn';

export interface AuthContextValue {
  status: AuthStatus;
  me: Me | null;
  /** Calls that need a sign-in. Refreshes an expired token once, by itself. */
  api: ApiClient;
  /** Calls that do not, such as asking for a code. */
  publicApi: ApiClient;
  completeSignIn: (result: SignInResult) => Promise<void>;
  signOut: () => Promise<void>;
  reloadMe: () => Promise<Me | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export { TOKENS_KEY } from './keys';

export interface AuthProviderProps {
  baseUrl: string;
  tokenStore: KeyValueStore;
  /** Defaults to the global fetch. Tests pass the contract's mock handler here. */
  fetch?: typeof fetch;
  getLocale?: () => Locale;
  /** Skips restoring from the store. For tests and previews. */
  initialSession?: { tokens: Tokens; me: Me };
  children: ReactNode;
}

/**
 * Holds the sign-in. The tokens live in the secure store of the device, never in the screen
 * state. Every API call in the app goes through `api` from here: the typed client from
 * `@qc/contracts`, with no hand-written requests.
 */
export function AuthProvider({
  baseUrl,
  tokenStore,
  fetch: baseFetch,
  getLocale,
  initialSession,
  children,
}: AuthProviderProps) {
  const [status, setStatus] = useState<AuthStatus>(initialSession ? 'signedIn' : 'restoring');
  const [me, setMe] = useState<Me | null>(initialSession?.me ?? null);
  const tokens = useRef<Tokens | null>(initialSession?.tokens ?? null);
  const mounted = useRef(true);
  const localeRef = useRef(getLocale);
  localeRef.current = getLocale;

  const rawFetch = baseFetch ?? ((input, init) => globalThis.fetch(input, init));

  const clients = useMemo(() => {
    const publicApi = createApiClient({
      baseUrl,
      fetch: rawFetch as typeof fetch,
      getLocale: () => localeRef.current?.() ?? 'ur',
    });
    const forget = async () => {
      tokens.current = null;
      await tokenStore.remove(TOKENS_KEY);
      if (mounted.current) {
        setMe(null);
        setStatus('signedOut');
      }
    };
    const authedFetch = createAuthedFetch(rawFetch as typeof fetch, {
      current: () => tokens.current,
      update: async (next) => {
        tokens.current = next;
        await tokenStore.set(TOKENS_KEY, JSON.stringify(next));
      },
      refresh: (refreshToken) => publicApi.auth.refresh({ body: { refreshToken } }),
      lost: () => void forget(),
    });
    const api = createApiClient({
      baseUrl,
      fetch: authedFetch,
      getAccessToken: () => tokens.current?.accessToken ?? null,
      getLocale: () => localeRef.current?.() ?? 'ur',
    });
    return { api, publicApi, forget };
  }, [baseUrl, tokenStore]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (initialSession) return;
    let cancelled = false;
    void (async () => {
      const raw = await tokenStore.get(TOKENS_KEY);
      const parsed = raw ? Tokens.safeParse(safeJson(raw)) : null;
      if (!parsed?.success) {
        if (!cancelled) setStatus('signedOut');
        return;
      }
      tokens.current = parsed.data;
      try {
        // The answer `startEarlyMe` asked for while the page loaded, if any, else ask now.
        const current =
          (await takeEarlyMe(parsed.data.accessToken, parseMe)) ?? (await clients.api.me.get());
        if (!cancelled) {
          setMe(current);
          setStatus('signedIn');
        }
      } catch (error) {
        // Offline at start: keep the tokens for the next launch and ask to sign in now.
        if (error instanceof ApiClientError && error.code === 'network_error') {
          tokens.current = null;
          if (!cancelled) setStatus('signedOut');
        } else if (!cancelled) {
          await clients.forget();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clients, tokenStore, initialSession]);

  const completeSignIn = useCallback(
    async (result: SignInResult) => {
      const next: Tokens = {
        accessToken: result.accessToken,
        accessTokenExpiresAt: result.accessTokenExpiresAt,
        refreshToken: result.refreshToken,
        refreshTokenExpiresAt: result.refreshTokenExpiresAt,
      };
      tokens.current = next;
      await tokenStore.set(TOKENS_KEY, JSON.stringify(next));
      setMe(result.me);
      setStatus('signedIn');
    },
    [tokenStore],
  );

  const signOut = useCallback(async () => {
    try {
      await clients.api.auth.signOut();
    } catch {
      /* the server may be unreachable; the device forgets the sign-in either way */
    }
    await clients.forget();
  }, [clients]);

  const reloadMe = useCallback(async () => {
    try {
      const current = await clients.api.me.get();
      setMe(current);
      return current;
    } catch {
      return null;
    }
  }, [clients]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      me,
      api: clients.api,
      publicApi: clients.publicApi,
      completeSignIn,
      signOut,
      reloadMe,
    }),
    [status, me, clients, completeSignIn, signOut, reloadMe],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function parseMe(data: unknown): Me | null {
  const checked = Me.safeParse(data);
  return checked.success ? checked.data : null;
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}

/** The signed-in person. Only call this below the sign-in gate. */
export function useMe(): Me {
  const { me } = useAuth();
  if (!me) throw new Error('useMe called without a signed-in person');
  return me;
}

export function useApi(): ApiClient {
  return useAuth().api;
}
