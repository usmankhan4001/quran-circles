import { createApiClient, type ApiClient } from '@qc/contracts';
import { stack } from './env';

/**
 * The contract's typed client against the real API. Responses are checked against the contract
 * schemas (the client's default), so any drift between the API and `@qc/contracts` fails the flow.
 * `ip` plays the reverse proxy's X-Forwarded-For, so each synthetic person has their own address.
 */
export function client(options: { token?: () => string | null; ip?: string } = {}): ApiClient {
  return createApiClient({
    baseUrl: stack().apiUrl,
    getAccessToken: options.token ?? (() => null),
    getLocale: () => 'en',
    fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      if (options.ip) headers.set('x-forwarded-for', options.ip);
      return fetch(input, { ...init, headers });
    },
  });
}
