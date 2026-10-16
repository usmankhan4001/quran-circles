import { renderTemplate, type Locale, type OtpChannel } from '@qc/contracts';
import { silentLogger, type Logger } from './logger';
import type { SmsProvider } from './providers/sms';
import { buildWhatsAppRequest, type WhatsAppProvider } from './providers/whatsapp';

/**
 * Sign-in code delivery for the auth-scopes lane.
 *
 * `CodeSender.send({ phone, code, locale, channel })` is the shape the auth lane calls. It resolves
 * when the code was handed to a provider and throws `CodeDeliveryError` when no channel worked.
 * Codes never go through `message_outbox`: the outbox payload is stored, and a code is stored only
 * as a hash. The sender reports spend through `onDelivery`, which carries no phone number or code.
 */
export interface CodeSendRequest {
  /** E.164, for example +923000000001. */
  phone: string;
  /** Six digits. */
  code: string;
  locale: Locale;
  channel: OtpChannel;
  /** How long the code works, shown in the SMS text. Defaults to the sender's setting. */
  minutes?: number;
}

export interface CodeSender {
  send(request: CodeSendRequest): Promise<void>;
}

export class CodeDeliveryError extends Error {
  override name = 'CodeDeliveryError';
  constructor(
    /** A fixed code such as `whatsapp_failed` or `all_channels_failed`. Never contains the phone or code. */
    readonly code: string,
  ) {
    super(code);
  }
}

export interface CodeDeliveryReport {
  /** The channel that carried the code, or the last one tried when none worked. */
  channel: OtpChannel;
  outcome: 'sent' | 'failed';
  /** True when WhatsApp was tried first and SMS carried it. */
  fellBack: boolean;
  costCategory: 'authentication';
}

export interface ProviderCodeSenderOptions {
  whatsapp?: WhatsAppProvider;
  sms?: SmsProvider;
  /** Send by SMS when WhatsApp fails or cannot reach the number. Defaults to true. */
  smsFallback?: boolean;
  /** Minutes a code works, for the SMS wording. Defaults to 10. */
  codeValidityMinutes?: number;
  languageCodes?: Partial<Record<Locale, string>>;
  logger?: Logger;
  onDelivery?: (report: CodeDeliveryReport) => void;
}

/**
 * Live delivery: a WhatsApp authentication template, with an SMS fallback.
 * - `channel: 'whatsapp'`: WhatsApp first; on any failure, SMS when configured and allowed.
 * - `channel: 'sms'`: SMS only.
 */
export class ProviderCodeSender implements CodeSender {
  constructor(private readonly options: ProviderCodeSenderOptions) {}

  async send(request: CodeSendRequest): Promise<void> {
    const log = this.options.logger ?? silentLogger;
    const minutes = request.minutes ?? this.options.codeValidityMinutes ?? 10;
    const report = (channel: OtpChannel, outcome: 'sent' | 'failed', fellBack: boolean): void =>
      this.options.onDelivery?.({ channel, outcome, fellBack, costCategory: 'authentication' });

    let triedWhatsApp = false;
    if (request.channel === 'whatsapp' && this.options.whatsapp) {
      triedWhatsApp = true;
      const result = await this.options.whatsapp.sendTemplate(
        buildWhatsAppRequest({
          key: 'auth_code',
          locale: request.locale,
          variables: { code: request.code, minutes: String(minutes) },
          to: request.phone,
          ...(this.options.languageCodes ? { languageCodes: this.options.languageCodes } : {}),
        }),
      );
      if (result.status === 'ok') {
        log.info('code.sent', { channel: 'whatsapp' });
        report('whatsapp', 'sent', false);
        return;
      }
      log.warn('code.whatsapp_failed', { errorCode: result.code });
      if (!this.options.sms || this.options.smsFallback === false) {
        report('whatsapp', 'failed', false);
        throw new CodeDeliveryError('whatsapp_failed');
      }
    }

    if (!this.options.sms) {
      report(request.channel, 'failed', false);
      throw new CodeDeliveryError('no_channel_configured');
    }
    const result = await this.options.sms.send({
      to: request.phone,
      body: renderTemplate('auth_code', request.locale, {
        code: request.code,
        minutes: String(minutes),
      }),
    });
    if (result.status === 'ok') {
      log.info('code.sent', { channel: 'sms', fellBack: triedWhatsApp });
      report('sms', 'sent', triedWhatsApp);
      return;
    }
    log.warn('code.sms_failed', { errorCode: result.code });
    report('sms', 'failed', triedWhatsApp);
    throw new CodeDeliveryError(triedWhatsApp ? 'all_channels_failed' : 'sms_failed');
  }
}

export interface TestCodeSenderOptions {
  /** Codes kept per phone number, newest last. Defaults to 5. */
  keep?: number;
}

/**
 * Test mode for staging and tests: no provider is called and nothing leaves the process. The
 * code for a number is available through `lastCode`, so an end-to-end test can sign in.
 * Never use it in production; the worker refuses to start with it when `NODE_ENV=production`.
 */
export class TestCodeSender implements CodeSender {
  private readonly codes = new Map<string, string[]>();
  readonly requests: CodeSendRequest[] = [];

  constructor(private readonly options: TestCodeSenderOptions = {}) {}

  send(request: CodeSendRequest): Promise<void> {
    this.requests.push(request);
    const list = this.codes.get(request.phone) ?? [];
    list.push(request.code);
    this.codes.set(request.phone, list.slice(-(this.options.keep ?? 5)));
    return Promise.resolve();
  }

  lastCode(phone: string): string | undefined {
    return this.codes.get(phone)?.at(-1);
  }
}
