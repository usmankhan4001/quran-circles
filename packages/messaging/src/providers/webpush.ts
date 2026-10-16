import webpush from 'web-push';
import { z } from 'zod';
import type { PushPayload } from '@qc/contracts';
import { fetchWithTimeout, parseRetryAfter, type FetchLike } from '../http';
import { pushDataStrings, type PushProvider, type PushSendResult, type PushTarget } from './push';

/** A web push device token: the browser's PushSubscription, serialised as JSON. */
export const WebPushSubscription = z.object({
  endpoint: z.url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});
export type WebPushSubscription = z.infer<typeof WebPushSubscription>;

export interface WebPushOptions {
  /** `mailto:` or https contact for the push services, required by VAPID. */
  subject: string;
  vapidPublicKey: string;
  vapidPrivateKey: string;
  fetch: FetchLike;
  timeoutMs?: number;
}

/**
 * Web push for the PWA. Encryption (RFC 8291) and the VAPID header come from the `web-push`
 * library's request builder; the request itself goes through the injected fetch.
 *
 * The page receives JSON `{ title, body, data, collapseKey }` in its service worker.
 */
export class WebPushProvider implements PushProvider {
  constructor(private readonly options: WebPushOptions) {}

  async send(target: PushTarget, payload: PushPayload): Promise<PushSendResult> {
    let subscription: WebPushSubscription;
    try {
      subscription = WebPushSubscription.parse(JSON.parse(target.token));
    } catch {
      return { status: 'invalid_token', code: 'webpush_bad_subscription' };
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
    let response;
    try {
      response = await fetchWithTimeout(
        this.options.fetch,
        details.endpoint,
        {
          method: details.method,
          headers: Object.fromEntries(
            Object.entries(details.headers as Record<string, unknown>).map(([k, v]) => [k, String(v)]),
          ),
          body: details.body as Uint8Array,
        },
        this.options.timeoutMs,
      );
    } catch {
      return { status: 'transient_failure', code: 'network_error' };
    }
    const status = response.status;
    if (status >= 200 && status < 300) return { status: 'ok' };
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
