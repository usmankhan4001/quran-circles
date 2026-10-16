import type { PushPayload } from '@qc/contracts';
import {
  fetchWithTimeout,
  isRecord,
  parseRetryAfter,
  readJson,
  type FetchLike,
} from '../http';
import { signJwtRs256 } from './jwt';
import { pushDataStrings, type PushProvider, type PushSendResult, type PushTarget } from './push';

export const FCM_DEFAULT_BASE_URL = 'https://fcm.googleapis.com';
export const GOOGLE_DEFAULT_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

export interface AccessTokenSource {
  getToken(): Promise<string>;
  /** Drop the cached token, for example after a 401. */
  invalidate(): void;
}

export interface ServiceAccountCredentials {
  clientEmail: string;
  /** PEM private key from the service-account JSON. Comes from the environment, never the repository. */
  privateKey: string;
  projectId: string;
}

/** Exchanges a signed service-account JWT for an OAuth access token and caches it until near expiry. */
export class GoogleServiceAccountTokenSource implements AccessTokenSource {
  private cached: { token: string; expiresAtMs: number } | undefined;

  constructor(
    private readonly credentials: ServiceAccountCredentials,
    private readonly fetchImpl: FetchLike,
    private readonly options: { tokenUrl?: string; now?: () => Date } = {},
  ) {}

  invalidate(): void {
    this.cached = undefined;
  }

  async getToken(): Promise<string> {
    const nowMs = (this.options.now?.() ?? new Date()).getTime();
    if (this.cached && this.cached.expiresAtMs - 60_000 > nowMs) return this.cached.token;
    const tokenUrl = this.options.tokenUrl ?? GOOGLE_DEFAULT_TOKEN_URL;
    const iat = Math.floor(nowMs / 1000);
    const assertion = signJwtRs256(this.credentials.privateKey, {
      iss: this.credentials.clientEmail,
      scope: FCM_SCOPE,
      aud: tokenUrl,
      iat,
      exp: iat + 3600,
    });
    const response = await fetchWithTimeout(this.fetchImpl, tokenUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }).toString(),
    });
    const json = await readJson(response);
    if (
      response.status !== 200 ||
      !isRecord(json) ||
      typeof json.access_token !== 'string' ||
      typeof json.expires_in !== 'number'
    ) {
      throw new Error('fcm_auth_failed');
    }
    this.cached = { token: json.access_token, expiresAtMs: nowMs + json.expires_in * 1000 };
    return json.access_token;
  }
}

export interface FcmOptions {
  projectId: string;
  auth: AccessTokenSource;
  fetch: FetchLike;
  baseUrl?: string;
  timeoutMs?: number;
}

/** Firebase Cloud Messaging HTTP v1, for Android and for iOS tokens issued through FCM. */
export class FcmPushProvider implements PushProvider {
  constructor(private readonly options: FcmOptions) {}

  async send(target: PushTarget, payload: PushPayload): Promise<PushSendResult> {
    let accessToken: string;
    try {
      accessToken = await this.options.auth.getToken();
    } catch {
      return { status: 'transient_failure', code: 'fcm_auth_unavailable' };
    }
    const base = (this.options.baseUrl ?? FCM_DEFAULT_BASE_URL).replace(/\/+$/, '');
    const url = `${base}/v1/projects/${encodeURIComponent(this.options.projectId)}/messages:send`;
    const message = {
      message: {
        token: target.token,
        notification: { title: payload.title, body: payload.body },
        data: pushDataStrings(payload),
        android: {
          priority: 'HIGH',
          ttl: `${payload.ttlSeconds}s`,
          ...(payload.collapseKey ? { collapse_key: payload.collapseKey } : {}),
        },
        apns: {
          headers: {
            'apns-expiration': String(Math.floor(Date.now() / 1000) + payload.ttlSeconds),
            ...(payload.collapseKey ? { 'apns-collapse-id': payload.collapseKey.slice(0, 64) } : {}),
          },
        },
      },
    };
    let response;
    try {
      response = await fetchWithTimeout(
        this.options.fetch,
        url,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${accessToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify(message),
        },
        this.options.timeoutMs,
      );
    } catch {
      return { status: 'transient_failure', code: 'network_error' };
    }
    return this.interpret(response.status, await readJson(response), response.headers.get('retry-after'));
  }

  private interpret(status: number, json: unknown, retryAfter: string | null): PushSendResult {
    if (status >= 200 && status < 300) {
      const name = isRecord(json) && typeof json.name === 'string' ? json.name : undefined;
      return name ? { status: 'ok', providerMessageId: name } : { status: 'ok' };
    }
    const error = isRecord(json) && isRecord(json.error) ? json.error : undefined;
    const details = Array.isArray(error?.details) ? error.details : [];
    const errorCode =
      details
        .map((d) => (isRecord(d) && typeof d.errorCode === 'string' ? d.errorCode : undefined))
        .find((c) => c !== undefined) ?? (typeof error?.status === 'string' ? error.status : '');
    const message = typeof error?.message === 'string' ? error.message : '';

    if (errorCode === 'UNREGISTERED' || status === 404) {
      return { status: 'invalid_token', code: 'fcm_unregistered' };
    }
    if (errorCode === 'SENDER_ID_MISMATCH') return { status: 'invalid_token', code: 'fcm_sender_mismatch' };
    if (status === 400 && /registration token/i.test(message)) {
      return { status: 'invalid_token', code: 'fcm_bad_token' };
    }
    if (status === 401) {
      this.options.auth.invalidate();
      return { status: 'transient_failure', code: 'fcm_unauthenticated' };
    }
    if (status === 429 || errorCode === 'QUOTA_EXCEEDED') {
      const hint = parseRetryAfter(retryAfter);
      return {
        status: 'transient_failure',
        code: 'fcm_quota',
        ...(hint !== undefined ? { retryAfterMs: hint } : {}),
      };
    }
    if (status >= 500) {
      const hint = parseRetryAfter(retryAfter);
      return {
        status: 'transient_failure',
        code: 'fcm_unavailable',
        ...(hint !== undefined ? { retryAfterMs: hint } : {}),
      };
    }
    return { status: 'permanent_failure', code: `fcm_http_${status}` };
  }
}
