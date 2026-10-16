import { describe, expect, it } from 'vitest';
import { TEMPLATES } from '@qc/contracts';
import { draftPushRow, draftTemplateRow } from './outbox-draft';

const sendAt = new Date('2026-11-02T10:00:00Z');
const push = {
  title: 'Update',
  body: 'A new update is posted',
  data: { type: 'update' as const, deepLink: 'qurancircles://updates' },
  ttlSeconds: 3600,
};

describe('outbox row drafts', () => {
  it('builds a push row that is free and has no phone', () => {
    const row = draftPushRow({
      idempotencyKey: 'k1',
      recipientUserId: 'u1',
      sendAt,
      push,
      cityId: 'c1',
    });
    expect(row).toMatchObject({
      channel: 'push',
      costCategory: 'free',
      recipientPhoneE164: null,
      templateKey: null,
      nextAttemptAt: sendAt,
      cityId: 'c1',
      payload: { channel: 'push' },
    });
  });

  it('rejects a push payload that breaks the contract', () => {
    expect(() =>
      draftPushRow({ idempotencyKey: 'k', sendAt, push: { ...push, body: '' } }),
    ).toThrow();
    expect(() =>
      draftPushRow({ idempotencyKey: 'k', sendAt, push: { ...push, title: '' } }),
    ).toThrow();
  });

  it('builds a template row whose cost comes from the catalog', () => {
    const row = draftTemplateRow({
      idempotencyKey: 'k2',
      channel: 'whatsapp',
      template: 'session_reminder',
      locale: 'ur',
      recipientUserId: 'u1',
      recipientPhoneE164: '+923000000001',
      sendAt,
      variables: {
        sessionTitle: 'Tafsir',
        venueName: 'Masjid',
        when: 'Fri 7 pm',
        link: 'https://x.test/o/1',
      },
    });
    expect(row.costCategory).toBe(TEMPLATES.session_reminder.costCategory);
    expect(row).toMatchObject({
      templateKey: 'session_reminder',
      locale: 'ur',
      recipientPhoneE164: '+923000000001',
    });
  });

  it('rejects missing or extra template variables', () => {
    expect(() =>
      draftTemplateRow({
        idempotencyKey: 'k',
        channel: 'whatsapp',
        template: 'session_reminder',
        locale: 'en',
        sendAt,
        // @ts-expect-error missing `when` and `link`
        variables: { sessionTitle: 'Tafsir', venueName: 'Masjid' },
      }),
    ).toThrow();
  });
});
