import { describe, expect, it } from 'vitest';
import { TEMPLATES, TEMPLATE_KEYS, type TemplateKey } from '@qc/contracts';
import { evaluateGate, type ConsentFact, type GateBlockReason, type GateInput } from './gate';

const NOW = new Date('2026-11-01T10:00:00Z');
const VENUE = '00000000-0000-4000-8000-0000000000a1';
const OTHER_VENUE = '00000000-0000-4000-8000-0000000000a2';
const USER = '00000000-0000-4000-8000-0000000000b1';

const consent = (over: Partial<ConsentFact> = {}): ConsentFact => ({
  channel: 'whatsapp',
  purpose: 'session_reminders',
  venueId: null,
  grantedAt: new Date('2026-10-01T00:00:00Z'),
  revokedAt: null,
  ...over,
});

const base = (over: Partial<GateInput> = {}): GateInput => ({
  channel: 'whatsapp',
  template: 'session_reminder',
  venueId: VENUE,
  recipient: { userId: USER, hasPhone: true, accountActive: true },
  consents: [],
  workingPushDevices: 0,
  now: NOW,
  ...over,
});

type Row = { name: string; input: GateInput; expected: 'allow' | GateBlockReason };

const rows: Row[] = [
  // Consent matrix, WhatsApp, a template that needs consent and has no push available
  { name: 'no consent record', input: base(), expected: 'no_consent' },
  {
    name: 'active global consent',
    input: base({ consents: [consent()] }),
    expected: 'allow',
  },
  {
    name: 'consent revoked',
    input: base({ consents: [consent({ revokedAt: new Date('2026-10-15T00:00:00Z') })] }),
    expected: 'no_consent',
  },
  {
    name: 'consent granted in the future is not yet active',
    input: base({ consents: [consent({ grantedAt: new Date('2026-12-01T00:00:00Z') })] }),
    expected: 'no_consent',
  },
  {
    name: 'consent for another purpose',
    input: base({ consents: [consent({ purpose: 'announcements' })] }),
    expected: 'no_consent',
  },
  {
    name: 'consent for another channel (sms, push)',
    input: base({ consents: [consent({ channel: 'sms' }), consent({ channel: 'push' })] }),
    expected: 'no_consent',
  },
  {
    name: 'consent for this venue',
    input: base({ consents: [consent({ venueId: VENUE })] }),
    expected: 'allow',
  },
  {
    name: 'consent for a different venue',
    input: base({ consents: [consent({ venueId: OTHER_VENUE })] }),
    expected: 'no_consent',
  },
  {
    name: 'revoked then granted again',
    input: base({
      consents: [
        consent({ revokedAt: new Date('2026-10-02T00:00:00Z') }),
        consent({ grantedAt: new Date('2026-10-20T00:00:00Z') }),
      ],
    }),
    expected: 'allow',
  },
  // Templates that need no consent: sign-in codes and coordinator invites
  {
    name: 'auth code over WhatsApp needs no consent',
    input: base({ template: 'auth_code', recipient: { userId: null, hasPhone: true, accountActive: true } }),
    expected: 'allow',
  },
  {
    name: 'auth code over SMS needs no consent',
    input: base({ channel: 'sms', template: 'auth_code', recipient: { userId: null, hasPhone: true, accountActive: true } }),
    expected: 'allow',
  },
  {
    name: 'coordinator invite over SMS needs no consent',
    input: base({ channel: 'sms', template: 'coordinator_invite', recipient: { userId: null, hasPhone: true, accountActive: true } }),
    expected: 'allow',
  },
  // Channel order
  {
    name: 'non-critical reminder over WhatsApp is blocked while push works',
    input: base({ consents: [consent()], workingPushDevices: 1 }),
    expected: 'push_available',
  },
  {
    name: 'critical change goes over WhatsApp even when push works',
    input: base({
      template: 'session_changed',
      consents: [consent({ purpose: 'registration_updates' })],
      workingPushDevices: 2,
    }),
    expected: 'allow',
  },
  {
    name: 'registration confirmation over WhatsApp with push working',
    input: base({
      template: 'registration_confirmation',
      consents: [consent({ purpose: 'registration_updates' })],
      workingPushDevices: 1,
    }),
    expected: 'allow',
  },
  {
    name: 'critical change still needs consent',
    input: base({ template: 'session_cancelled', workingPushDevices: 1 }),
    expected: 'no_consent',
  },
  // Channel and recipient shape
  {
    name: 'template that does not allow SMS',
    input: base({ channel: 'sms', template: 'session_reminder', consents: [consent({ channel: 'sms' })] }),
    expected: 'channel_not_allowed',
  },
  {
    name: 'WhatsApp row without a phone',
    input: base({ recipient: { userId: USER, hasPhone: false, accountActive: true }, consents: [consent()] }),
    expected: 'no_recipient',
  },
  {
    name: 'suspended account',
    input: base({ recipient: { userId: USER, hasPhone: true, accountActive: false }, consents: [consent()] }),
    expected: 'account_inactive',
  },
  // Push
  {
    name: 'push to a person with a working device and no consent rows',
    input: base({ channel: 'push', template: null, pushType: 'reminder', workingPushDevices: 1 }),
    expected: 'allow',
  },
  {
    name: 'push with no working device',
    input: base({ channel: 'push', template: null, pushType: 'reminder', workingPushDevices: 0 }),
    expected: 'no_working_push',
  },
  {
    name: 'push after the person revoked push for the purpose',
    input: base({
      channel: 'push',
      template: null,
      pushType: 'reminder',
      workingPushDevices: 1,
      consents: [consent({ channel: 'push', revokedAt: new Date('2026-10-10T00:00:00Z') })],
    }),
    expected: 'push_opted_out',
  },
  {
    name: 'revoked push consent for a different purpose does not block',
    input: base({
      channel: 'push',
      template: null,
      pushType: 'reminder',
      workingPushDevices: 1,
      consents: [
        consent({ channel: 'push', purpose: 'announcements', revokedAt: new Date('2026-10-10T00:00:00Z') }),
      ],
    }),
    expected: 'allow',
  },
  {
    name: 'push without a user',
    input: base({
      channel: 'push',
      template: null,
      pushType: 'update',
      workingPushDevices: 1,
      recipient: { userId: null, hasPhone: false, accountActive: true },
    }),
    expected: 'no_recipient',
  },
  // Wave 4 seam: limits
  {
    name: 'daily cap reached blocks a non-critical WhatsApp message',
    input: base({
      consents: [consent()],
      limits: { whatsappDailyCap: 1, whatsappSentToday: 1 },
    }),
    expected: 'daily_cap',
  },
  {
    name: 'under the daily cap',
    input: base({ consents: [consent()], limits: { whatsappDailyCap: 1, whatsappSentToday: 0 } }),
    expected: 'allow',
  },
  {
    name: 'no cap configured',
    input: base({ consents: [consent()], limits: { whatsappDailyCap: null, whatsappSentToday: 9 } }),
    expected: 'allow',
  },
  {
    name: 'the cap does not stop a critical template',
    input: base({
      template: 'session_changed',
      consents: [consent({ purpose: 'registration_updates' })],
      limits: { whatsappDailyCap: 1, whatsappSentToday: 5 },
    }),
    expected: 'allow',
  },
  {
    name: 'city budget exhausted',
    input: base({
      consents: [consent()],
      limits: { cityBudgetRemaining: 0, estimatedCost: 1 },
    }),
    expected: 'city_budget',
  },
];

describe('send gate', () => {
  it.each(rows)('$name', ({ input, expected }) => {
    const decision = evaluateGate(input);
    if (expected === 'allow') expect(decision).toEqual({ allow: true });
    else expect(decision).toEqual({ allow: false, reason: expected });
  });

  it('never allows a consent-requiring WhatsApp template without consent, for every template', () => {
    for (const key of TEMPLATE_KEYS as TemplateKey[]) {
      const def = TEMPLATES[key];
      if (!def.requiresConsent || !def.channels.includes('whatsapp')) continue;
      for (const pushDevices of [0, 1]) {
        const decision = evaluateGate(
          base({ template: key, workingPushDevices: pushDevices, consents: [] }),
        );
        expect(decision.allow, `${key} with ${pushDevices} devices`).toBe(false);
      }
    }
  });

  it('allows every template that needs no consent to reach its allowed channels', () => {
    for (const key of TEMPLATE_KEYS as TemplateKey[]) {
      const def = TEMPLATES[key];
      if (def.requiresConsent) continue;
      for (const channel of def.channels) {
        if (channel === 'push') continue;
        const decision = evaluateGate(
          base({ channel, template: key, recipient: { userId: null, hasPhone: true, accountActive: true } }),
        );
        expect(decision, `${key} over ${channel}`).toEqual({ allow: true });
      }
    }
  });
});
