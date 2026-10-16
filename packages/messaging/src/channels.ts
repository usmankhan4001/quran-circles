import { TEMPLATES, type MessageChannel, type TemplateKey } from '@qc/contracts';

/**
 * Which channels to queue for a message, in order. The send-time gate still checks each one; this
 * only decides what is worth putting in the outbox.
 *
 * - Push and on-device come first. A person with a working push device gets a push.
 * - Critical templates (codes, confirmations, critical changes) are also sent over WhatsApp
 *   whatever the person's push state.
 * - A non-critical template goes over WhatsApp only for a person with no working push, and only
 *   when the caller allows the fallback (Wave 4 turns it on per city with a feature flag).
 * - SMS is never queued here: it is the code-delivery fallback, handled by the code sender.
 */
export interface ChannelPlanInput {
  template: TemplateKey;
  hasWorkingPush: boolean;
  /** `whatsapp_fallback_reminders` and similar. */
  allowWhatsAppFallback: boolean;
}

export function planChannels(input: ChannelPlanInput): MessageChannel[] {
  const def = TEMPLATES[input.template];
  const allowed = def.channels;
  const plan: MessageChannel[] = [];
  if (allowed.includes('push') && input.hasWorkingPush) plan.push('push');
  if (allowed.includes('whatsapp')) {
    if (def.critical) plan.push('whatsapp');
    else if (!input.hasWorkingPush && input.allowWhatsAppFallback) plan.push('whatsapp');
  }
  return plan;
}
