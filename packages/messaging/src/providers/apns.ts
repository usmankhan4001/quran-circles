import type { PushPayload } from '@qc/contracts';
import {
  fetchWithTimeout,
  isRecord,
  parseRetryAfter,
  readJson,
  type FetchLike,
} from '../http';
import { signJwtEs256 } from './jwt';
import { pushDataStrings, type PushProvider, type PushSendResult, type PushTarget } from './push';

export const APNS_PRODUCTION_URL = 'https://api.push.apple.com';
export const APNS_SANDBOX_URL = 'https://api.sandbox.push.apple.com';

export interface ApnsOptions {
  teamId: string;
  keyId: string;
  /** The .p8 key as PEM text. Comes from the environment, never the repository. */
  privateKey: string;
  /** The app's bundle id, sent as `apns-topic`. */
  bundleId: string;
  /**
   * APNs requires HTTP/2. Pass a fetch that speaks it (the worker provides `createHttp2Fetch`).
   * Tests pass a scripted fake.
   */
  fetch: FetchLike;
  baseUrl?: string;
  production?: boolean;
  timeoutMs?: number;
  now?: () => Date;
}

/** Apple Push Notification service over its HTTP/2 provider API, with token-based authentication. */
export class ApnsPushProvider implements PushProvider {
  private jwt: { token: string; issuedAtMs: number } | undefined;

  constructor(private readonly options: ApnsOptions) {}

  private now(): Date {
    return this.options.now?.() ?? new Date();
  }

  /** APNs wants a fresh token at most once per 20 minutes and none older than an hour. */
  private providerToken(): string {
    const nowMs = this.now().getTime();
    if (this.jwt && nowMs - this.jwt.issuedAtMs < 40 * 60_000) return this.jwt.token;
    const token = signJwtEs256(
      this.options.privateKey,
      { iss: this.options.teamId, iat: Math.floor(nowMs / 1000) },
      { kid: this.options.keyId },
    );
    this.jwt = { token, issuedAtMs: nowMs };
    return token;
  }

  async send(target: PushTarget, payload: PushPayload): Promise<PushSendResult> {
    const base = (
      this.options.baseUrl ??
      (this.options.production === false ? APNS_SANDBOX_URL : APNS_PRODUCTION_URL)
    ).replace(/\/+$/, '');
    const url = `${base}/3/device/${encodeURIComponent(target.token)}`;
    const expiration = Math.floor(this.now().getTime() / 1000) + payload.ttlSeconds;
    const headers: Record<string, string> = {
      authorization: `bearer ${this.providerToken()}`,
      'apns-topic': this.options.bundleId,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'apns-expiration': String(expiration),
      'content-type': 'application/json',
    };
    if (payload.collapseKey) headers['apns-collapse-id'] = payload.collapseKey.slice(0, 64);
    const body = JSON.stringify({
      aps: { alert: { title: payload.title, body: payload.body }, sound: 'default' },
      ...pushDataStrings(payload),
    });
    let response;
    try {
      response = await fetchWithTimeout(
        this.options.fetch,
        url,
        { method: 'POST', headers, body },
        this.options.timeoutMs,
      );
    } catch {
      return { status: 'transient_failure', code: 'network_error' };
    }
    if (response.status === 200) {
      const id = response.headers.get('apns-id');
      return id ? { status: 'ok', providerMessageId: id } : { status: 'ok' };
    }
    const json = await readJson(response);
    const reason = isRecord(json) && typeof json.reason === 'string' ? json.reason : '';
    if (response.status === 410 || reason === 'Unregistered') {
      return { status: 'invalid_token', code: 'apns_unregistered' };
    }
    if (reason === 'BadDeviceToken' || reason === 'DeviceTokenNotForTopic') {
      return { status: 'invalid_token', code: 'apns_bad_token' };
    }
    if (reason === 'ExpiredProviderToken' || reason === 'InvalidProviderToken') {
      this.jwt = undefined;
      return { status: 'transient_failure', code: 'apns_provider_token' };
    }
    if (response.status === 429 || response.status >= 500) {
      const hint = parseRetryAfter(response.headers.get('retry-after'));
      return {
        status: 'transient_failure',
        code: response.status === 429 ? 'apns_rate_limited' : 'apns_unavailable',
        ...(hint !== undefined ? { retryAfterMs: hint } : {}),
      };
    }
    return { status: 'permanent_failure', code: `apns_http_${response.status}` };
  }
}
