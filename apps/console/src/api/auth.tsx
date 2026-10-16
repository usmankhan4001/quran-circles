import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import {
  createApiClient,
  type ApiClient,
  type Me,
  type Principal,
  type RequestCodeBody,
} from '@qc/contracts';
import { principalFromMe } from '../lib/permissions';
import { webStore, type KeyValueStore } from '../lib/storage';
import { useI18n } from '../i18n';

/**
 * Sign-in for the console. Coordinators sign in with a phone code. The short-lived access token
 * lives only in memory. The refresh token is kept in this tab's session storage so a reload does
 * not sign the person out; closing the tab does. If storage is blocked the console still works,
 * the person just signs in again after a reload.
 */
const REFRESH_KEY = 'qc.console.refresh';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';
export type VerifyResult = { ok: true } | { ok: false; reason: 'no_access' };

export interface AuthContextValue {
  status: AuthStatus;
  me: Me | null;
  principal: Principal | null;
  api: ApiClient;
  requestCode(
    phone: string,
    channel?: RequestCodeBody['channel'],
  ): ReturnType<ApiClient['auth']['requestCode']>;
  verifyCode(challengeId: string, code: string): Promise<VerifyResult>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export interface AuthProviderProps {
  /** Public configuration: the API origin, or '' for same-origin behind the proxy. */
  baseUrl: string;
  fetchImpl?: typeof fetch;
  tokenStore?: KeyValueStore;
  children: ReactNode;
}

export function AuthProvider({ baseUrl, fetchImpl, tokenStore, children }: AuthProviderProps) {
  const { locale } = useI18n();
  const localeRef = useRef(locale);
  localeRef.current = locale;

  const store = useMemo(() => tokenStore ?? webStore('session'), [tokenStore]);
  const accessToken = useRef<string | null>(null);
  const refreshing = useRef<Promise<string | null> | null>(null);
  const [state, setState] = useState<{ status: AuthStatus; me: Me | null }>({
    status: 'loading',
    me: null,
  });

  const { api, publicApi, refreshAccess } = useMemo(() => {
    const baseFetch: typeof fetch = fetchImpl ?? ((...args) => fetch(...args));
    const common = { baseUrl, getLocale: () => localeRef.current };
    const publicApi = createApiClient({ ...common, fetch: baseFetch });

    const lose = () => {
      accessToken.current = null;
      store.remove(REFRESH_KEY);
      setState({ status: 'signedOut', me: null });
    };

    const refreshAccess = (): Promise<string | null> => {
      refreshing.current ??= (async () => {
        const refreshToken = store.get(REFRESH_KEY);
        if (!refreshToken) return null;
        try {
          const tokens = await publicApi.auth.refresh({ body: { refreshToken } });
          accessToken.current = tokens.accessToken;
          store.set(REFRESH_KEY, tokens.refreshToken);
          return tokens.accessToken;
        } catch {
          return null;
        } finally {
          refreshing.current = null;
        }
      })();
      return refreshing.current;
    };

    // Retries a request once with a fresh token when the access token has expired.
    const authedFetch: typeof fetch = async (input, init) => {
      const response = await baseFetch(input, init);
      const sentToken = new Headers(init?.headers).has('authorization');
      if (response.status !== 401 || !sentToken) return response;
      const body = (await response
        .clone()
        .json()
        .catch(() => null)) as { error?: { code?: string } } | null;
      if (body?.error?.code === 'token_expired') {
        const fresh = await refreshAccess();
        if (fresh) {
          const headers = new Headers(init?.headers);
          headers.set('authorization', `Bearer ${fresh}`);
          return baseFetch(input, { ...init, headers });
        }
      }
      lose();
      return response;
    };

    const api = createApiClient({
      ...common,
      fetch: authedFetch,
      getAccessToken: () => accessToken.current,
    });
    return { api, publicApi, refreshAccess };
  }, [baseUrl, fetchImpl, store]);

  // On first load, trade a stored refresh token for a fresh sign-in.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = await refreshAccess();
      if (!token) {
        if (!cancelled) setState({ status: 'signedOut', me: null });
        return;
      }
      try {
        const me = await api.me.get();
        if (!cancelled) setState({ status: me.roles.length > 0 ? 'signedIn' : 'signedOut', me });
      } catch {
        if (!cancelled) setState({ status: 'signedOut', me: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, refreshAccess]);

  const requestCode = useCallback<AuthContextValue['requestCode']>(
    (phone, channel = 'whatsapp') =>
      publicApi.auth.requestCode({ body: { phone, locale: localeRef.current, channel } }),
    [publicApi],
  );

  const signOut = useCallback(async () => {
    try {
      await api.auth.signOut();
    } catch {
      /* the local sign-out below still happens */
    }
    accessToken.current = null;
    store.remove(REFRESH_KEY);
    setState({ status: 'signedOut', me: null });
  }, [api, store]);

  const verifyCode = useCallback<AuthContextValue['verifyCode']>(
    async (challengeId, code) => {
      const res = await publicApi.auth.verifyCode({
        body: { challengeId, code, deviceLabel: 'Console' },
      });
      accessToken.current = res.accessToken;
      store.set(REFRESH_KEY, res.refreshToken);
      if (res.me.roles.length === 0) {
        // Attendees have accounts but no console access.
        await signOut();
        return { ok: false, reason: 'no_access' };
      }
      setState({ status: 'signedIn', me: res.me });
      return { ok: true };
    },
    [publicApi, signOut, store],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status: state.status,
      me: state.me,
      principal: state.me ? principalFromMe(state.me) : null,
      api,
      requestCode,
      verifyCode,
      signOut,
    }),
    [state, api, requestCode, verifyCode, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** For pages that only render for a signed-in person. */
export function useSignedIn(): AuthContextValue & { me: Me; principal: Principal } {
  const auth = useAuth();
  if (!auth.me || !auth.principal) throw new Error('Signed-in page rendered while signed out');
  return auth as AuthContextValue & { me: Me; principal: Principal };
}
