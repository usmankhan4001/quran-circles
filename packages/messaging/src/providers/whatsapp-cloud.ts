import { fetchWithTimeout, isRecord, parseRetryAfter, readJson, type FetchLike } from '../http';
import type {
  WhatsAppFailureCause,
  WhatsAppProvider,
  WhatsAppSendResult,
  WhatsAppTemplateRequest,
} from './whatsapp';

export const GRAPH_DEFAULT_BASE_URL = 'https://graph.facebook.com';
export const GRAPH_DEFAULT_VERSION = 'v23.0';

export interface WhatsAppCloudOptions {
  /** The business phone number id (not the number itself). */
  phoneNumberId: string;
  /** System-user access token from the environment. A function allows rotation without a restart. */
  accessToken: string | (() => string);
  fetch: FetchLike;
  /** Defaults to the documented Graph API origin. Configurable for proxies and staging. */
  graphBaseUrl?: string;
  apiVersion?: string;
  timeoutMs?: number;
}

type ErrorClass = { transient: boolean; cause: WhatsAppFailureCause };

/**
 * Graph API error codes, from Meta's Cloud API error reference. Anything not listed here and sent
 * with a 4xx status is permanent; 5xx and rate limits are transient.
 */
const ERROR_CODES: Record<number, ErrorClass> = {
  // Throughput and rate limits
  4: { transient: true, cause: 'other' },
  80007: { transient: true, cause: 'other' },
  130429: { transient: true, cause: 'other' },
  131048: { transient: true, cause: 'other' },
  131056: { transient: true, cause: 'other' },
  // Service problems
  1: { transient: true, cause: 'other' },
  2: { transient: true, cause: 'other' },
  131000: { transient: true, cause: 'other' },
  131016: { transient: true, cause: 'other' },
  133004: { transient: true, cause: 'other' },
  // Expired or invalid access token: our configuration, and a human must fix it
  190: { transient: false, cause: 'configuration' },
  10: { transient: false, cause: 'configuration' },
  200: { transient: false, cause: 'configuration' },
  131031: { transient: false, cause: 'configuration' },
  // The recipient cannot receive it
  131026: { transient: false, cause: 'recipient' },
  131030: { transient: false, cause: 'recipient' },
  131021: { transient: false, cause: 'recipient' },
  131047: { transient: false, cause: 'recipient' },
  131049: { transient: false, cause: 'recipient' },
  131050: { transient: false, cause: 'recipient' },
  // Template problems
  132000: { transient: false, cause: 'template' },
  132001: { transient: false, cause: 'template' },
  132005: { transient: false, cause: 'template' },
  132007: { transient: false, cause: 'template' },
  132012: { transient: false, cause: 'template' },
  132015: { transient: false, cause: 'template' },
  132016: { transient: false, cause: 'template' },
  132068: { transient: false, cause: 'template' },
  132069: { transient: false, cause: 'template' },
};

/** Maps a Graph error code (or an HTTP status when there is none) to a retry decision. */
export function classifyGraphError(
  errorCode: number | undefined,
  httpStatus: number,
): ErrorClass & { code: string } {
  if (errorCode !== undefined) {
    const known = ERROR_CODES[errorCode];
    if (known) return { ...known, code: `wa_${errorCode}` };
  }
  const code = errorCode !== undefined ? `wa_${errorCode}` : `wa_http_${httpStatus}`;
  if (httpStatus === 429 || httpStatus >= 500) return { transient: true, cause: 'other', code };
  if (httpStatus === 401) return { transient: false, cause: 'configuration', code };
  return { transient: false, cause: 'other', code };
}

/** Meta's WhatsApp Cloud API. Sends approved templates only. */
export class WhatsAppCloudClient implements WhatsAppProvider {
  constructor(private readonly options: WhatsAppCloudOptions) {}

  private endpoint(): string {
    const base = (this.options.graphBaseUrl ?? GRAPH_DEFAULT_BASE_URL).replace(/\/+$/, '');
    const version = this.options.apiVersion ?? GRAPH_DEFAULT_VERSION;
    return `${base}/${version}/${encodeURIComponent(this.options.phoneNumberId)}/messages`;
  }

  async sendTemplate(request: WhatsAppTemplateRequest): Promise<WhatsAppSendResult> {
    const components: unknown[] = [];
    if (request.bodyParams.length > 0) {
      components.push({
        type: 'body',
        parameters: request.bodyParams.map((text) => ({ type: 'text', text })),
      });
    }
    if (request.buttonParam !== undefined) {
      components.push({
        type: 'button',
        sub_type: 'url',
        index: '0',
        parameters: [{ type: 'text', text: request.buttonParam }],
      });
    }
    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: request.to.replace(/^\+/, ''),
      type: 'template',
      template: {
        name: request.templateName,
        language: { code: request.language },
        ...(components.length > 0 ? { components } : {}),
      },
      ...(request.callbackData ? { biz_opaque_callback_data: request.callbackData } : {}),
    };
    const token =
      typeof this.options.accessToken === 'function'
        ? this.options.accessToken()
        : this.options.accessToken;
    let response;
    try {
      response = await fetchWithTimeout(
        this.options.fetch,
        this.endpoint(),
        {
          method: 'POST',
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          body: JSON.stringify(body),
        },
        this.options.timeoutMs,
      );
    } catch {
      return { status: 'transient_failure', code: 'network_error' };
    }
    const json = await readJson(response);
    if (response.status >= 200 && response.status < 300) {
      const messages = isRecord(json) && Array.isArray(json.messages) ? json.messages : [];
      const first = messages[0];
      const id = isRecord(first) && typeof first.id === 'string' ? first.id : undefined;
      if (id) return { status: 'ok', providerMessageId: id };
      return { status: 'transient_failure', code: 'wa_no_message_id' };
    }
    const error = isRecord(json) && isRecord(json.error) ? json.error : undefined;
    const errorCode = typeof error?.code === 'number' ? error.code : undefined;
    const classified = classifyGraphError(errorCode, response.status);
    if (classified.transient) {
      const hint = parseRetryAfter(response.headers.get('retry-after'));
      return {
        status: 'transient_failure',
        code: classified.code,
        ...(hint !== undefined ? { retryAfterMs: hint } : {}),
      };
    }
    return { status: 'permanent_failure', code: classified.code, cause: classified.cause };
  }
}
