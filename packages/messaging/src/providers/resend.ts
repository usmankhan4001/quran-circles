import { fetchWithTimeout, isRecord, parseRetryAfter, readJson, type FetchLike } from '../http';
import type { EmailMessage, EmailProvider, EmailSendResult } from './email';

export const RESEND_API_URL = 'https://api.resend.com/emails';

export interface ResendOptions {
  /** The API key (`re_...`). From the environment, never from code or files. */
  apiKey: string;
  /**
   * The sender, for example `Quran Circles <codes@mail.example.org>`. Its domain must be verified in
   * Resend, or Resend only delivers to the account owner's own address.
   */
  from: string;
  /** Where replies go, if not to `from`. */
  replyTo?: string;
  apiUrl?: string;
  fetch: FetchLike;
  timeoutMs?: number;
}

/**
 * Sends mail through Resend's HTTP API (`POST /emails`, bearer key). Answers with fixed codes only:
 * no response text, address or key is returned or logged.
 */
export class ResendEmailProvider implements EmailProvider {
  constructor(private readonly options: ResendOptions) {}

  async send(message: EmailMessage): Promise<EmailSendResult> {
    let response;
    try {
      response = await fetchWithTimeout(
        this.options.fetch,
        this.options.apiUrl ?? RESEND_API_URL,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${this.options.apiKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            from: this.options.from,
            to: [message.to],
            subject: message.subject,
            text: message.text,
            html: message.html,
            ...(this.options.replyTo ? { reply_to: this.options.replyTo } : {}),
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
        code: `resend_http_${response.status}`,
        ...(hint !== undefined ? { retryAfterMs: hint } : {}),
      };
    }
    // 401/403: bad key or an unverified sender domain; 422: the address or body was refused.
    return { status: 'permanent_failure', code: `resend_http_${response.status}` };
  }
}
