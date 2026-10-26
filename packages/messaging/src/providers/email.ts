export interface EmailMessage {
  /** The recipient's address. Never logged. */
  to: string;
  subject: string;
  /** Plain text, always sent: the part mail apps show when they do not draw HTML. */
  text: string;
  /** The branded version. */
  html: string;
}

export type EmailSendResult =
  | { status: 'ok'; providerMessageId?: string }
  | { status: 'transient_failure'; code: string; retryAfterMs?: number }
  | { status: 'permanent_failure'; code: string };

export interface EmailProvider {
  send(message: EmailMessage): Promise<EmailSendResult>;
}

/** Hides most of an address for logs and dev output: `ab***@example.org`. */
export function maskEmail(address: string): string {
  const at = address.lastIndexOf('@');
  if (at < 1) return '***';
  return `${address.slice(0, Math.min(2, at))}***${address.slice(at)}`;
}

/**
 * Development fallback when no Resend key is set: nothing leaves the process; the message is handed
 * to `write` (the console by default) with the address masked, so a developer can read the code.
 * Never construct it in production; `createMessaging` refuses to.
 */
export class ConsoleEmailProvider implements EmailProvider {
  readonly sent: EmailMessage[] = [];

  constructor(private readonly write: (line: string) => void = (line) => console.info(line)) {}

  send(message: EmailMessage): Promise<EmailSendResult> {
    this.sent.push(message);
    this.write(`[email:dev] to ${maskEmail(message.to)} | ${message.subject}\n${message.text}`);
    return Promise.resolve({ status: 'ok', providerMessageId: `console-${this.sent.length}` });
  }
}
