export interface SmsMessage {
  /** E.164 with the plus sign. */
  to: string;
  /** Final text, already rendered in the recipient's language. Never logged. */
  body: string;
}

export type SmsSendResult =
  | { status: 'ok'; providerMessageId?: string }
  | { status: 'transient_failure'; code: string; retryAfterMs?: number }
  | { status: 'permanent_failure'; code: string };

export interface SmsProvider {
  send(message: SmsMessage): Promise<SmsSendResult>;
}
