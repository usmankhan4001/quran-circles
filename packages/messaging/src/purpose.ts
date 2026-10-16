import type { ConsentPurpose, PushPayload, TemplateKey } from '@qc/contracts';

/** The consent purpose a WhatsApp or SMS template needs. `null`: nobody has to consent (codes, invites). */
export const TEMPLATE_PURPOSE: Record<TemplateKey, ConsentPurpose | null> = {
  auth_code: null,
  coordinator_invite: null,
  registration_confirmation: 'registration_updates',
  session_reminder: 'session_reminders',
  session_changed: 'registration_updates',
  session_cancelled: 'registration_updates',
  waitlist_promoted: 'registration_updates',
  circle_opened: 'announcements',
};

/** The consent purpose a push notification falls under. */
export const PUSH_TYPE_PURPOSE: Record<PushPayload['data']['type'], ConsentPurpose> = {
  update: 'announcements',
  reminder: 'session_reminders',
  session_changed: 'registration_updates',
  session_cancelled: 'registration_updates',
  waitlist_promoted: 'registration_updates',
  circle_opened: 'announcements',
};
