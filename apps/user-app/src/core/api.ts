import { ApiClientError, createApiClient, type ApiClient } from '@qc/contracts';
import type { AuthSession } from '../auth/session';
import type { Connectivity } from './connectivity';

export interface ApiConfig {
  baseUrl: string;
  /** Replaces the global fetch; tests pass the contract's mock handler through it. */
  fetch?: typeof fetch;
  getLocale: () => 'en' | 'ur';
}

/** A client with no token: for the calls that happen before or during sign-in. */
export function createPublicApi(config: ApiConfig): ApiClient {
  return createApiClient({
    baseUrl: config.baseUrl,
    ...(config.fetch ? { fetch: config.fetch } : {}),
    getLocale: config.getLocale,
  });
}

type AnyCall = (...args: unknown[]) => Promise<unknown>;

/**
 * Wraps every call of a client. A call that fails with `token_expired` is tried once more
 * after the tokens are refreshed. Reaching the server, or failing to, is reported to
 * `connectivity` for the offline banner.
 */
export function wrapClient(
  api: ApiClient,
  hooks: {
    session: Pick<AuthSession, 'refresh'>;
    connectivity: Pick<Connectivity, 'markOffline' | 'markOnline'>;
  },
): ApiClient {
  const wrapped: Record<string, Record<string, AnyCall>> = {};
  for (const [group, operations] of Object.entries(api as unknown as Record<string, Record<string, AnyCall>>)) {
    const out: Record<string, AnyCall> = {};
    for (const [name, call] of Object.entries(operations)) {
      out[name] = async (...args) => {
        const attempt = async (): Promise<unknown> => {
          try {
            const result = await call(...args);
            hooks.connectivity.markOnline();
            return result;
          } catch (error) {
            if (error instanceof ApiClientError) {
              if (error.code === 'network_error') hooks.connectivity.markOffline();
              else hooks.connectivity.markOnline();
            }
            throw error;
          }
        };
        try {
          return await attempt();
        } catch (error) {
          if (error instanceof ApiClientError && error.code === 'token_expired') {
            let refreshed = false;
            try {
              refreshed = await hooks.session.refresh();
            } catch (refreshError) {
              if (refreshError instanceof ApiClientError && refreshError.code === 'network_error') {
                hooks.connectivity.markOffline();
              }
              throw refreshError;
            }
            if (refreshed) return attempt();
          }
          throw error;
        }
      };
    }
    wrapped[group] = out;
  }
  return wrapped as unknown as ApiClient;
}

/** The app's API client: typed, authorised, refreshing and reporting connectivity. */
export function createAppApi(
  config: ApiConfig,
  session: AuthSession,
  connectivity: Connectivity,
): ApiClient {
  const authorised = createApiClient({
    baseUrl: config.baseUrl,
    ...(config.fetch ? { fetch: config.fetch } : {}),
    getLocale: config.getLocale,
    getAccessToken: () => session.getAccessToken(),
  });
  return wrapClient(authorised, { session, connectivity });
}
