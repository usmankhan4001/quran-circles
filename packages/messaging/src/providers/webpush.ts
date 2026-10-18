import webpush from 'web-push';
import {
  WebPushSubscriptionToken,
  isAllowedWebPushEndpoint,
  parseWebPushToken,
  type PushPayload,
} from '@qc/contracts';
import { fetchWithTimeout, parseRetryAfter, type FetchLike } from '../http';
import { pushDataStrings, type PushProvider, type PushSendResult, type PushTarget } from './push';

/**
 * A web push device token: the browser's PushSubscription, serialised as JSON. The endpoint must
 * be https on a known push service (`isAllowedWebPushEndpoint` in `@qc/contracts`, SEC-01).
 */
export const WebPushSubscription = WebPushSubscriptionToken;
export type WebPushSubscription = WebPushSubscriptionToken;

/** Web push requests give up after this long; the push services answer in well under a second. */
export const WEB_PUSH_TIMEOUT_MS = 5_000;

export interface WebPushOptions {
  /** `mailto:` or https contact for the push services, required by VAPID. */
  subject: string;
  vapidPublicKey: string;
  vapidPrivateKey: string;
  fetch: FetchLike;
  /** Defaults to `WEB_PUSH_TIMEOUT_MS`. */
  timeoutMs?: number;
}

/**
 * Web push for the PWA. Encryption (RFC 8291) and the VAPID header come from the `web-push`
 * library's request builder; the request itself goes through the injected fetch.
 *
 * The page receives JSON `{ title, body, data, collapseKey }` in its service worker.
 *
 * SSRF defence (SEC-01), on top of the API's check at registration: a token whose endpoint is not
 * https on a known push service is refused without a request and reported as `invalid_token`, so
 * the worker revokes the device. Redirects are never followed (`redirect: 'manual'`, and any 3xx
 * answer revokes the device too), and each request has a short timeout.
 */
export class WebPushProvider implements PushProvider {
  constructor(private readonly options: WebPushOptions) {}

  async send(target: PushTarget, payload: PushPayload): Promise<PushSendResult> {
    const subscription = parseWebPushToken(target.token);
    if (!subscription) {
      const endpoint = endpointOf(target.token);
      const refused = endpoint !== null && !isAllowedWebPushEndpoint(endpoint);
      return {
        status: 'invalid_token',
        code: refused ? 'webpush_endpoint_refused' : 'webpush_bad_subscription',
      };
    }
    let details;
    try {
      details = webpush.generateRequestDetails(
        subscription,
        JSON.stringify({
          title: payload.title,
          body: payload.body,
          data: { ...pushDataStrings(payload) },
          collapseKey: payload.collapseKey,
        }),
        {
          TTL: payload.ttlSeconds,
          urgency: 'high',
          ...(payload.collapseKey
            ? { topic: payload.collapseKey.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 32) }
            : {}),
          vapidDetails: {
            subject: this.options.subject,
            publicKey: this.options.vapidPublicKey,
            privateKey: this.options.vapidPrivateKey,
          },
        },
      );
    } catch {
      return { status: 'permanent_failure', code: 'webpush_bad_request' };
    }
    // The library sends to the subscription's endpoint; check what it will actually call.
    if (!isAllowedWebPushEndpoint(details.endpoint)) {
      return { status: 'invalid_token', code: 'webpush_endpoint_refused' };
    }
    let response;
    try {
      response = await fetchWithTimeout(
        this.options.fetch,
        details.endpoint,
        {
          method: details.method,
          headers: Object.fromEntries(
            Object.entries(details.headers as Record<string, unknown>).map(([k, v]) => [
              k,
              String(v),
            ]),
          ),
          body: details.body as Uint8Array,
          redirect: 'manual',
        },
        this.options.timeoutMs ?? WEB_PUSH_TIMEOUT_MS,
      );
    } catch {
      return { status: 'transient_failure', code: 'network_error' };
    }
    const status = response.status;
    if (status >= 200 && status < 300) return { status: 'ok' };
    // A push service never redirects. `redirect: 'manual'` hands the 3xx back (status 0 where the
    // runtime makes it opaque); following it could reach any host, so the device is revoked.
    if (status === 0 || (status >= 300 && status < 400)) {
      return { status: 'invalid_token', code: 'webpush_redirect_refused' };
    }
    if (status === 404 || status === 410) return { status: 'invalid_token', code: 'webpush_gone' };
    if (status === 429 || status >= 500) {
      const hint = parseRetryAfter(response.headers.get('retry-after'));
      return {
        status: 'transient_failure',
        code: status === 429 ? 'webpush_rate_limited' : 'webpush_unavailable',
        ...(hint !== undefined ? { retryAfterMs: hint } : {}),
      };
    }
    return { status: 'permanent_failure', code: `webpush_http_${status}` };
  }
}

/** The `endpoint` string of a token that is JSON with one, else `null` (to name the refusal). */
function endpointOf(token: string): string | null {
  try {
    const json: unknown = JSON.parse(token);
    if (typeof json === 'object' && json !== null && 'endpoint' in json) {
      const endpoint = (json as { endpoint: unknown }).endpoint;
      return typeof endpoint === 'string' ? endpoint : null;
    }
  } catch {
    // not JSON
  }
  return null;
}
