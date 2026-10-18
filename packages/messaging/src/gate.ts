import {
  TEMPLATES,
  type ConsentChannel,
  type ConsentPurpose,
  type MessageChannel,
  type TemplateKey,
} from '@qc/contracts';
import { PUSH_TYPE_PURPOSE, TEMPLATE_PURPOSE } from './purpose';

/**
 * The send gate. Pure: the worker loads the facts, this decides. Every outbox row passes through
 * it immediately before the provider is called, whatever created the row.
 *
 * Rules (docs/product/messaging.md):
 * 1. WhatsApp and SMS: a template that needs consent is sent only with an active consent record
 *    for that channel and purpose (for the person, global or for the message's venue).
 * 2. Push has no consent row by default, because the device token is the permission. An explicit
 *    revoked push consent for the purpose stops it ("one tap stops messages").
 * 3. Order: WhatsApp only for critical templates (codes, confirmations, critical changes) or for
 *    people with no working push device.
 * 4. Push needs at least one working device.
 * 5. Limits (SEC-02), applied to WhatsApp when the worker supplies them: at most the daily cap of
 *    template messages per person per day, and a monthly budget per city. The product rule names
 *    no exemption, so critical templates (confirmations, critical changes) are capped and budgeted
 *    like any other; being critical only lets them skip rule 3. Sign-in codes (cost category
 *    `authentication`) are the one exception: they skip the city budget, so a city that ran out
 *    can still sign in, but they still count toward and are stopped by the per-person cap.
 */

export interface ConsentFact {
  channel: ConsentChannel;
  purpose: ConsentPurpose;
  venueId: string | null;
  grantedAt: Date;
  revokedAt: Date | null;
}

/** Figures the worker reads from settings and the outbox (SEC-02). All optional. */
export interface GateLimits {
  /** `whatsapp_daily_cap_per_person`. `null` or absent: no cap. */
  whatsappDailyCap?: number | null;
  /** WhatsApp template messages already sent to this person today (Pakistan day). */
  whatsappSentToday?: number;
  /** Remaining monthly budget for the message's city, in the settings' unit. `null`: no budget. */
  cityBudgetRemaining?: number | null;
  /** The city's whole monthly budget, for the alert as it nears the limit. Not used by the gate. */
  cityBudget?: number | null;
  /** What this message would cost against the budget. */
  estimatedCost?: number;
}

export type GateBlockReason =
  | 'no_recipient'
  | 'account_inactive'
  | 'channel_not_allowed'
  | 'no_consent'
  | 'push_opted_out'
  | 'no_working_push'
  | 'push_available'
  | 'daily_cap'
  | 'city_budget';

export type GateDecision = { allow: true } | { allow: false; reason: GateBlockReason };

export interface GateInput {
  channel: MessageChannel;
  /** The template for WhatsApp and SMS; `null` for a push notification. */
  template: TemplateKey | null;
  /** Push type, for the consent purpose of a push notification. */
  pushType?: keyof typeof PUSH_TYPE_PURPOSE;
  /** The venue the message is about, if any. Per-venue consent applies to it. */
  venueId?: string | null;
  recipient: {
    userId: string | null;
    /** A phone number is on the row or on the user's account. */
    hasPhone: boolean;
    accountActive: boolean;
  };
  consents: readonly ConsentFact[];
  /** Devices with a token that is not revoked. */
  workingPushDevices: number;
  limits?: GateLimits;
  now: Date;
}

const blocked = (reason: GateBlockReason): GateDecision => ({ allow: false, reason });

/** Whether `consent` covers a message about `venueId` for `purpose` on `channel` at `now`. */
function covers(
  consent: ConsentFact,
  channel: ConsentChannel,
  purpose: ConsentPurpose,
  venueId: string | null,
): boolean {
  if (consent.channel !== channel || consent.purpose !== purpose) return false;
  return consent.venueId === null || consent.venueId === venueId;
}

export function hasActiveConsent(
  consents: readonly ConsentFact[],
  channel: ConsentChannel,
  purpose: ConsentPurpose,
  venueId: string | null,
  now: Date,
): boolean {
  return consents.some(
    (c) =>
      covers(c, channel, purpose, venueId) &&
      c.grantedAt.getTime() <= now.getTime() &&
      (c.revokedAt === null || c.revokedAt.getTime() > now.getTime()),
  );
}

/** Push is blocked only when the person revoked it and has no active consent that covers it. */
function pushOptedOut(
  consents: readonly ConsentFact[],
  purpose: ConsentPurpose,
  venueId: string | null,
  now: Date,
): boolean {
  const relevant = consents.filter((c) => covers(c, 'push', purpose, venueId));
  if (relevant.length === 0) return false;
  return !hasActiveConsent(consents, 'push', purpose, venueId, now);
}

export function evaluateGate(input: GateInput): GateDecision {
  const { channel, template, recipient, now } = input;
  const venueId = input.venueId ?? null;
  const def = template ? TEMPLATES[template] : null;

  if (channel === 'push') {
    if (!recipient.userId) return blocked('no_recipient');
  } else {
    if (!def || !def.channels.includes(channel)) return blocked('channel_not_allowed');
    if (!recipient.hasPhone) return blocked('no_recipient');
  }
  if (!recipient.accountActive) return blocked('account_inactive');

  if (channel === 'push') {
    const purpose = input.pushType ? PUSH_TYPE_PURPOSE[input.pushType] : null;
    if (purpose && pushOptedOut(input.consents, purpose, venueId, now)) {
      return blocked('push_opted_out');
    }
    if (input.workingPushDevices < 1) return blocked('no_working_push');
    return { allow: true };
  }

  // WhatsApp or SMS from here; `def` is set.
  const template_ = def!;
  if (template_.requiresConsent) {
    const purpose = TEMPLATE_PURPOSE[template!];
    // A consent-requiring template always has a purpose; if the catalog ever breaks that, refuse.
    if (!purpose) return blocked('no_consent');
    if (!hasActiveConsent(input.consents, channel, purpose, venueId, now)) {
      return blocked('no_consent');
    }
  }
  if (channel === 'whatsapp' && !template_.critical && input.workingPushDevices > 0) {
    return blocked('push_available');
  }

  const limits = input.limits;
  if (channel === 'whatsapp' && limits) {
    const cap = limits.whatsappDailyCap;
    if (cap !== null && cap !== undefined && (limits.whatsappSentToday ?? 0) >= cap) {
      return blocked('daily_cap');
    }
    const remaining = limits.cityBudgetRemaining;
    if (
      template_.costCategory !== 'authentication' &&
      remaining !== null &&
      remaining !== undefined &&
      (limits.estimatedCost ?? 0) > remaining
    ) {
      return blocked('city_budget');
    }
  }
  return { allow: true };
}
