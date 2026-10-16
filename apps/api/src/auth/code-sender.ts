import type { Locale, OtpChannel, PhoneE164 } from '@qc/contracts';

export interface CodeMessage {
  phone: PhoneE164;
  /** The six digits. Never logged. */
  code: string;
  /** The language of the message that carries the code. */
  locale: Locale;
  channel: OtpChannel;
}

/**
 * Delivers a sign-in code. The messaging lane provides the real one (a WhatsApp authentication
 * template, with the SMS gateway as fallback) through `@qc/messaging`. It throws when the message
 * could not be handed to the provider. It may return the channel it actually used when it fell
 * back, so the response can tell the person where to look.
 */
export interface CodeSender {
  send(message: CodeMessage): Promise<{ channel: OtpChannel } | void>;
}

/** Records messages instead of sending them. For tests. */
export class FakeCodeSender implements CodeSender {
  readonly sent: CodeMessage[] = [];
  /** Make the next `send` calls fail, to test delivery errors. */
  failWith: Error | null = null;
  /** Pretend a fallback happened. */
  reportChannel: OtpChannel | null = null;

  async send(message: CodeMessage): Promise<{ channel: OtpChannel } | void> {
    if (this.failWith) throw this.failWith;
    this.sent.push({ ...message });
    if (this.reportChannel) return { channel: this.reportChannel };
  }

  get last(): CodeMessage | undefined {
    return this.sent[this.sent.length - 1];
  }
}

/**
 * Sends nothing. Use with a fixed test code on staging when no provider is connected: the code
 * is known, so there is nothing to deliver.
 */
export class DiscardCodeSender implements CodeSender {
  async send(): Promise<void> {}
}
