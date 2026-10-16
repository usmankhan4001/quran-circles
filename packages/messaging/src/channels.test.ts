import { describe, expect, it } from 'vitest';
import type { MessageChannel, TemplateKey } from '@qc/contracts';
import { planChannels } from './channels';

type Row = {
  template: TemplateKey;
  hasWorkingPush: boolean;
  allowWhatsAppFallback: boolean;
  expected: MessageChannel[];
};

const rows: Row[] = [
  // Non-critical reminder: push first; WhatsApp only as a fallback when allowed
  {
    template: 'session_reminder',
    hasWorkingPush: true,
    allowWhatsAppFallback: false,
    expected: ['push'],
  },
  {
    template: 'session_reminder',
    hasWorkingPush: true,
    allowWhatsAppFallback: true,
    expected: ['push'],
  },
  {
    template: 'session_reminder',
    hasWorkingPush: false,
    allowWhatsAppFallback: false,
    expected: [],
  },
  {
    template: 'session_reminder',
    hasWorkingPush: false,
    allowWhatsAppFallback: true,
    expected: ['whatsapp'],
  },
  // Critical changes: push first, and WhatsApp as well
  {
    template: 'session_changed',
    hasWorkingPush: true,
    allowWhatsAppFallback: false,
    expected: ['push', 'whatsapp'],
  },
  {
    template: 'session_cancelled',
    hasWorkingPush: false,
    allowWhatsAppFallback: false,
    expected: ['whatsapp'],
  },
  {
    template: 'waitlist_promoted',
    hasWorkingPush: true,
    allowWhatsAppFallback: false,
    expected: ['push', 'whatsapp'],
  },
  // Confirmation lists push and WhatsApp
  {
    template: 'registration_confirmation',
    hasWorkingPush: true,
    allowWhatsAppFallback: false,
    expected: ['push', 'whatsapp'],
  },
  {
    template: 'registration_confirmation',
    hasWorkingPush: false,
    allowWhatsAppFallback: false,
    expected: ['whatsapp'],
  },
  // Codes and invites never use push
  {
    template: 'auth_code',
    hasWorkingPush: true,
    allowWhatsAppFallback: false,
    expected: ['whatsapp'],
  },
  {
    template: 'coordinator_invite',
    hasWorkingPush: false,
    allowWhatsAppFallback: false,
    expected: ['whatsapp'],
  },
  // Marketing: push, or WhatsApp only as an allowed fallback
  {
    template: 'circle_opened',
    hasWorkingPush: true,
    allowWhatsAppFallback: true,
    expected: ['push'],
  },
  { template: 'circle_opened', hasWorkingPush: false, allowWhatsAppFallback: false, expected: [] },
];

describe('channel order', () => {
  it.each(rows)('$template push=$hasWorkingPush fallback=$allowWhatsAppFallback', (row) => {
    expect(planChannels(row)).toEqual(row.expected);
  });

  it('never plans SMS', () => {
    for (const row of rows) expect(planChannels(row)).not.toContain('sms');
  });
});
