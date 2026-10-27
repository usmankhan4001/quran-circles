import { renderTemplate, type Locale, type OtpChannel } from '@qc/contracts';
import { silentLogger, type Logger } from './logger';
import { renderBrandedEmail, type EmailRenderer } from './email-render';
import type { EmailProvider } from './providers/email';
import type { SmsProvider } from './providers/sms';
import { buildWhatsAppRequest, type WhatsAppProvider } from './providers/whatsapp';

/**
 * Sign-in code delivery for the auth-scopes lane.
 *
 * Since 2026-10-25 (owner decision) codes go by email (`channel: 'email'`, through Resend). The
 * WhatsApp and SMS paths below are kept and used only when the API has WhatsApp sign-in switched on.
 *
 * `CodeSender.send({ email | phone, code, locale, channel })` is the shape the auth lane calls. It resolves
 * with the channel that carried the code once a provider accepted it (`sms` after a WhatsApp
 * failure, so the app can tell the person where to look) and throws `CodeDeliveryError` when no
 * channel worked. Everyone, staff included, gets WhatsApp first with SMS as the fallback (owner
 * decision of 2026-10-17).
 * Codes never go through `message_outbox`: the outbox payload is stored, and a code is stored only
 * as a hash. The sender reports spend through `onDelivery`, which carries no phone number or code.
 */
/**
 * How long a sign-in code works, in minutes: the API's code lifetime (`otp.ttlSeconds`, 5 minutes,
 * in `apps/api/src/auth/config.ts`). The message states it, so the two must agree (SEC-21).
 */
export const DEFAULT_CODE_VALIDITY_MINUTES = 5;

export interface CodeSendRequest {
  /** E.164, for example +923000000001. Set for the WhatsApp and SMS channels. */
  phone?: string;
  /** The address for the email channel. */
  email?: string;
  /** Six digits. */
  code: string;
  locale: Locale;
  channel: OtpChannel;
  /**
   * How long the code works, shown in the message. Pass the real lifetime when the caller knows
   * it; otherwise the sender's setting applies.
   */
  minutes?: number;
}

export interface CodeSendResult {
  /** The channel that carried the code. */
  channel: OtpChannel;
}

export interface CodeSender {
  send(request: CodeSendRequest): Promise<CodeSendResult>;
}

export class CodeDeliveryError extends Error {
  override name = 'CodeDeliveryError';
  constructor(
    /** A fixed code such as `email_failed`, `whatsapp_failed` or `all_channels_failed`. Never contains the address, phone or code. */
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
  email?: EmailProvider;
  /** Renders the code email. Defaults to the branded sign-in code template. */
  renderEmail?: EmailRenderer;
  whatsapp?: WhatsAppProvider;
  sms?: SmsProvider;
  /** Send by SMS when WhatsApp fails or cannot reach the number. Defaults to true. */
  smsFallback?: boolean;
  /** Minutes a code works, for the message wording. Defaults to `DEFAULT_CODE_VALIDITY_MINUTES`. */
  codeValidityMinutes?: number;
  languageCodes?: Partial<Record<Locale, string>>;
  logger?: Logger;
  onDelivery?: (report: CodeDeliveryReport) => void;
}

/**
 * Live delivery: email, or a WhatsApp authentication template with an SMS fallback.
 * - `channel: 'email'`: the email provider only (Resend); no fallback to a phone channel, because the
 *   person gave an address.
 * - `channel: 'whatsapp'`: WhatsApp first; on any failure, SMS when configured and allowed.
 * - `channel: 'sms'`: SMS only.
 */
export class ProviderCodeSender implements CodeSender {
  constructor(private readonly options: ProviderCodeSenderOptions) {}

  async send(request: CodeSendRequest): Promise<CodeSendResult> {
    const log = this.options.logger ?? silentLogger;
    const minutes =
      request.minutes ?? this.options.codeValidityMinutes ?? DEFAULT_CODE_VALIDITY_MINUTES;
    const report = (channel: OtpChannel, outcome: 'sent' | 'failed', fellBack: boolean): void =>
      this.options.onDelivery?.({ channel, outcome, fellBack, costCategory: 'authentication' });

    if (request.channel === 'email') {
      if (!request.email) throw new CodeDeliveryError('no_recipient');
      if (!this.options.email) {
        report('email', 'failed', false);
        throw new CodeDeliveryError('no_channel_configured');
      }
      const result = await this.options.email.send({
        to: request.email,
        ...(this.options.renderEmail ?? renderBrandedEmail)('auth_code', request.locale, {
          code: request.code,
          minutes,
        }),
      });
      if (result.status === 'ok') {
        log.info('code.sent', { channel: 'email' });
        report('email', 'sent', false);
        return { channel: 'email' };
      }
      log.warn('code.email_failed', { errorCode: result.code });
      report('email', 'failed', false);
      throw new CodeDeliveryError('email_failed');
    }

    if (!request.phone) throw new CodeDeliveryError('no_recipient');
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
        return { channel: 'whatsapp' };
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
      return { channel: 'sms' };
    }
    log.warn('code.sms_failed', { errorCode: result.code });
    report('sms', 'failed', triedWhatsApp);
    throw new CodeDeliveryError(triedWhatsApp ? 'all_channels_failed' : 'sms_failed');
  }
}

export interface TestCodeSenderOptions {
  /** Codes kept per address or number, newest last. Defaults to 5. */
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

  send(request: CodeSendRequest): Promise<CodeSendResult> {
    this.requests.push(request);
    const key = request.email ?? request.phone;
    if (!key) throw new CodeDeliveryError('no_recipient');
    const list = this.codes.get(key) ?? [];
    list.push(request.code);
    this.codes.set(key, list.slice(-(this.options.keep ?? 5)));
    return Promise.resolve({ channel: request.channel });
  }

  /** The newest code kept for an email address or a phone number. */
  lastCode(addressOrPhone: string): string | undefined {
    return this.codes.get(addressOrPhone)?.at(-1);
  }
}
