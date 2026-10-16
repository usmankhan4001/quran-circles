import type { PushPayload } from '@qc/contracts';
import type { PushProvider, PushSendResult, PushTarget } from './providers/push';
import type { SmsMessage, SmsProvider, SmsSendResult } from './providers/sms';
import type {
  WhatsAppProvider,
  WhatsAppSendResult,
  WhatsAppTemplateRequest,
} from './providers/whatsapp';

/**
 * Fake providers. Every test uses these; none touches a network. Each records what it was asked to
 * send, answers `ok` by default, and can be scripted to fail in the ways real providers do.
 *
 * Failures are a queue: `failNext(result, times)` answers the next `times` calls with `result`,
 * then goes back to `ok`. `respondWith(fn)` takes over completely for finer control.
 */
class Scriptable<Req, Res> {
  readonly calls: Req[] = [];
  private queued: Res[] = [];
  private responder: ((request: Req) => Res | undefined) | undefined;

  /** Answer the next `times` calls with `result`. */
  failNext(result: Res, times = 1): this {
    for (let i = 0; i < times; i++) this.queued.push(result);
    return this;
  }

  /** Answer calls with `fn`. Returning `undefined` falls through to the queue and then `ok`. */
  respondWith(fn: ((request: Req) => Res | undefined) | undefined): this {
    this.responder = fn;
    return this;
  }

  reset(): void {
    this.calls.length = 0;
    this.queued = [];
    this.responder = undefined;
  }

  protected answer(request: Req, ok: () => Res): Res {
    this.calls.push(request);
    return this.responder?.(request) ?? this.queued.shift() ?? ok();
  }
}

export interface RecordedPush {
  target: PushTarget;
  payload: PushPayload;
}

export class FakePushProvider
  extends Scriptable<RecordedPush, PushSendResult>
  implements PushProvider
{
  private counter = 0;
  private readonly invalid = new Set<string>();

  /** Tokens the fake reports as dead, like a provider answering Unregistered. */
  invalidateToken(token: string): this {
    this.invalid.add(token);
    return this;
  }

  get sent(): RecordedPush[] {
    return this.calls;
  }

  send(target: PushTarget, payload: PushPayload): Promise<PushSendResult> {
    if (this.invalid.has(target.token)) {
      this.calls.push({ target, payload });
      return Promise.resolve({ status: 'invalid_token', code: 'fake_unregistered' });
    }
    return Promise.resolve(
      this.answer({ target, payload }, () => ({
        status: 'ok',
        providerMessageId: `fake-push-${++this.counter}`,
      })),
    );
  }
}

export class FakeWhatsAppProvider
  extends Scriptable<WhatsAppTemplateRequest, WhatsAppSendResult>
  implements WhatsAppProvider
{
  private counter = 0;

  get sent(): WhatsAppTemplateRequest[] {
    return this.calls;
  }

  sendTemplate(request: WhatsAppTemplateRequest): Promise<WhatsAppSendResult> {
    return Promise.resolve(
      this.answer(request, () => ({
        status: 'ok',
        providerMessageId: `wamid.fake-${++this.counter}`,
      })),
    );
  }
}

export class FakeSmsProvider extends Scriptable<SmsMessage, SmsSendResult> implements SmsProvider {
  private counter = 0;

  get sent(): SmsMessage[] {
    return this.calls;
  }

  send(message: SmsMessage): Promise<SmsSendResult> {
    return Promise.resolve(
      this.answer(message, () => ({
        status: 'ok',
        providerMessageId: `fake-sms-${++this.counter}`,
      })),
    );
  }
}
