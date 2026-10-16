import type { PushPayload, PushProvider as PushTransportKind } from '@qc/contracts';

/** A device token and the transport that understands it. For web push the token is the JSON subscription. */
export interface PushTarget {
  kind: PushTransportKind;
  token: string;
}

/**
 * What happened to one push to one device.
 * - `invalid_token`: the provider says this token is dead. The worker marks the device revoked.
 * - `transient_failure`: try again later (provider down, rate limited, network).
 * - `permanent_failure`: retrying will not help (bad payload, provider not configured).
 */
export type PushSendResult =
  | { status: 'ok'; providerMessageId?: string }
  | { status: 'invalid_token'; code: string }
  | { status: 'transient_failure'; code: string; retryAfterMs?: number }
  | { status: 'permanent_failure'; code: string };

export interface PushProvider {
  send(target: PushTarget, payload: PushPayload): Promise<PushSendResult>;
}

/** The data map every transport carries, with string values only (FCM and APNs require it). */
export function pushDataStrings(payload: PushPayload): Record<string, string> {
  const out: Record<string, string> = { type: payload.data.type, deepLink: payload.data.deepLink };
  if (payload.data.updateId) out.updateId = payload.data.updateId;
  if (payload.data.sessionId) out.sessionId = payload.data.sessionId;
  if (payload.data.occurrenceId) out.occurrenceId = payload.data.occurrenceId;
  return out;
}

/** Sends each target through the provider that handles its transport. */
export class PushRouter implements PushProvider {
  constructor(
    private readonly providers: Partial<Record<PushTransportKind, PushProvider>>,
  ) {}

  send(target: PushTarget, payload: PushPayload): Promise<PushSendResult> {
    const provider = this.providers[target.kind];
    if (!provider) {
      return Promise.resolve({ status: 'permanent_failure', code: 'provider_not_configured' });
    }
    return provider.send(target, payload);
  }
}
