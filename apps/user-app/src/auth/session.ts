import { ApiClientError, type Me, type Tokens } from '@qc/contracts';
import { Observable } from '../core/observable';
import { readJson, writeJson, type KeyValueStore } from '../core/storage';

export type AuthStatus = 'restoring' | 'signedOut' | 'signedIn';

export interface AuthState {
  status: AuthStatus;
  /** The signed-in person. Null until `me.get` or a sign-in has returned it. */
  me: Me | null;
}

export const TOKENS_KEY = 'qc.tokens.v1';

function isTokens(value: unknown): value is Tokens {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.accessToken === 'string' &&
    typeof v.accessTokenExpiresAt === 'string' &&
    typeof v.refreshToken === 'string' &&
    typeof v.refreshTokenExpiresAt === 'string'
  );
}

export interface AuthSessionOptions {
  /** Where tokens live: the secure store on a phone, local storage on the web. */
  storage: KeyValueStore;
  /** Exchanges a refresh token for new tokens. Uses a client without authorisation. */
  refreshTokens: (refreshToken: string) => Promise<Tokens>;
  now?: () => number;
  /** A token this close to its end is refreshed before it is used. */
  skewMs?: number;
}

/**
 * Holds the tokens and the signed-in state. It refreshes an expiring access token before a
 * call and, on `token_expired`, once for the call that failed. Refresh tokens rotate and
 * reuse signs the device out, so refreshing is single-flight and the new tokens are saved
 * before they are used.
 */
export class AuthSession {
  private readonly state = new Observable<AuthState>({ status: 'restoring', me: null });
  private tokens: Tokens | null = null;
  private inflight: Promise<boolean> | null = null;
  private readonly now: () => number;
  private readonly skewMs: number;

  constructor(private readonly options: AuthSessionOptions) {
    this.now = options.now ?? Date.now;
    this.skewMs = options.skewMs ?? 30_000;
  }

  getState = (): AuthState => this.state.get();
  subscribe = (listener: () => void): (() => void) => this.state.subscribe(listener);

  /** Reads saved tokens at start-up. A refresh token that has run out means signed out. */
  async restore(): Promise<AuthState> {
    const saved = await readJson(this.options.storage, TOKENS_KEY, isTokens);
    if (saved && Date.parse(saved.refreshTokenExpiresAt) > this.now()) {
      this.tokens = saved;
      this.state.set({ status: 'signedIn', me: null });
    } else {
      if (saved) await this.options.storage.remove(TOKENS_KEY);
      this.state.set({ status: 'signedOut', me: null });
    }
    return this.state.get();
  }

  async signIn(tokens: Tokens, me: Me): Promise<void> {
    this.tokens = tokens;
    await writeJson(this.options.storage, TOKENS_KEY, tokens);
    this.state.set({ status: 'signedIn', me });
  }

  setMe(me: Me | null): void {
    const current = this.state.get();
    if (current.status === 'signedIn') this.state.set({ status: 'signedIn', me });
  }

  /** Forgets the tokens on this device. The server side is `auth.signOut`, called by the screen. */
  async clear(): Promise<void> {
    this.tokens = null;
    await this.options.storage.remove(TOKENS_KEY).catch(() => undefined);
    this.state.set({ status: 'signedOut', me: null });
  }

  /** The token to send, refreshed first if it is about to run out. Null when signed out. */
  async getAccessToken(): Promise<string | null> {
    if (!this.tokens) return null;
    if (Date.parse(this.tokens.accessTokenExpiresAt) - this.now() <= this.skewMs) {
      try {
        await this.refresh();
      } catch {
        // Offline: send the old token; the server decides, and the caller sees the real error.
      }
    }
    return this.tokens?.accessToken ?? null;
  }

  /**
   * Gets new tokens. Resolves true when it worked and false when the sign-in is over (the
   * device is then signed out). Rejects on a network failure, keeping the tokens for later.
   */
  refresh(): Promise<boolean> {
    this.inflight ??= this.doRefresh().finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  private async doRefresh(): Promise<boolean> {
    const current = this.tokens;
    if (!current) return false;
    try {
      const next = await this.options.refreshTokens(current.refreshToken);
      this.tokens = next;
      await writeJson(this.options.storage, TOKENS_KEY, next);
      return true;
    } catch (error) {
      if (error instanceof ApiClientError && error.code === 'network_error') throw error;
      await this.clear();
      return false;
    }
  }
}
