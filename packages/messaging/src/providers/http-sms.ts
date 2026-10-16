import { fetchWithTimeout, isRecord, parseRetryAfter, readJson, type FetchLike } from '../http';
import type { SmsMessage, SmsProvider, SmsSendResult } from './sms';

export interface HttpSmsOptions {
  /** The gateway's send endpoint. Comes from the environment: the gateway is not chosen yet. */
  url: string;
  /** Sent as a bearer token. */
  apiKey: string;
  /** Sender id or short code, if the gateway needs one. */
  sender?: string;
  fetch: FetchLike;
  timeoutMs?: number;
}

/**
 * A generic JSON SMS gateway adapter: POST `{ to, text, sender }` with a bearer key, expect a 2xx.
 * A stand-in until the owner picks a gateway; a gateway with a different shape gets its own
 * `SmsProvider` behind the same interface.
 */
export class HttpSmsProvider implements SmsProvider {
  constructor(private readonly options: HttpSmsOptions) {}

  async send(message: SmsMessage): Promise<SmsSendResult> {
    let response;
    try {
      response = await fetchWithTimeout(
        this.options.fetch,
        this.options.url,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${this.options.apiKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            to: message.to,
            text: message.body,
            ...(this.options.sender ? { sender: this.options.sender } : {}),
          }),
        },
        this.options.timeoutMs,
      );
    } catch {
      return { status: 'transient_failure', code: 'network_error' };
    }
    if (response.status >= 200 && response.status < 300) {
      const json = await readJson(response);
      const id = isRecord(json) && typeof json.id === 'string' ? json.id : undefined;
      return id ? { status: 'ok', providerMessageId: id } : { status: 'ok' };
    }
    if (response.status === 429 || response.status >= 500) {
      const hint = parseRetryAfter(response.headers.get('retry-after'));
      return {
        status: 'transient_failure',
        code: `sms_http_${response.status}`,
        ...(hint !== undefined ? { retryAfterMs: hint } : {}),
      };
    }
    return { status: 'permanent_failure', code: `sms_http_${response.status}` };
  }
}
