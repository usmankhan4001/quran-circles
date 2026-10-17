import { describe, expect, it } from 'vitest';
import {
  APP_SCHEME,
  OutboxPayload,
  PushPayload,
  TEMPLATES,
  TEMPLATE_KEYS,
  TEMPLATE_VARIABLES,
  buildDeepLink,
  outboxKey,
  parseDeepLink,
  renderTemplate,
  templatePlaceholders,
  type DeepLink,
} from './messages';
import { fixtureId } from './fixtures';

const sid = fixtureId('session', 1);

describe('deep links', () => {
  const links: DeepLink[] = [
    { type: 'session', sessionId: sid },
    { type: 'occurrence', occurrenceId: fixtureId('occurrence', 101) },
    { type: 'register', sessionId: sid },
    { type: 'venue', venueId: fixtureId('venue', 1) },
    { type: 'circle', circleId: fixtureId('circle', 1) },
    { type: 'update', updateId: fixtureId('update', 1) },
    { type: 'updates' },
    { type: 'journey' },
  ];

  for (const link of links) {
    it(`round-trips ${link.type} with the app scheme and with a web base`, () => {
      const app = buildDeepLink(link);
      expect(app.startsWith(`${APP_SCHEME}://`)).toBe(true);
      expect(parseDeepLink(app)).toEqual(link);
      const web = buildDeepLink(link, 'https://example.org/');
      expect(web.startsWith('https://example.org/')).toBe(true);
      expect(web).not.toContain('//session//');
      expect(parseDeepLink(web)).toEqual(link);
    });
  }

  it('rejects links it does not understand', () => {
    for (const bad of [
      '',
      'not a url',
      'qurancircles://nowhere/1',
      'qurancircles://session/not-a-uuid',
      'https://example.org/',
    ]) {
      expect(parseDeepLink(bad), bad).toBeNull();
    }
  });
});

describe('templates', () => {
  it('has the sign-in and registration templates the plan calls for', () => {
    expect(TEMPLATE_KEYS).toEqual(
      expect.arrayContaining(['auth_code', 'registration_confirmation', 'session_reminder']),
    );
  });

  for (const key of TEMPLATE_KEYS) {
    it(`${key}: both languages use exactly the declared variables`, () => {
      const declared = Object.keys(TEMPLATE_VARIABLES[key].shape).sort();
      for (const locale of ['en', 'ur'] as const) {
        const used = templatePlaceholders(TEMPLATES[key].body[locale]).sort();
        expect(used, `${key} ${locale}`).toEqual(declared.filter((v) => used.includes(v)));
        expect(used.length).toBeGreaterThan(0);
      }
      expect(templatePlaceholders(TEMPLATES[key].body.en).sort()).toEqual(
        templatePlaceholders(TEMPLATES[key].body.ur).sort(),
      );
    });

    it(`${key}: is marked as an unreviewed Urdu draft and not Meta-approved`, () => {
      expect(TEMPLATES[key].urduStatus).toBe('draft');
      expect(TEMPLATES[key].waTemplateName).toMatch(/^qc_[a-z_]+$/);
    });
  }

  it('only lets sign-in and invite messages skip consent', () => {
    const noConsent = TEMPLATE_KEYS.filter((k) => !TEMPLATES[k].requiresConsent).sort();
    expect(noConsent).toEqual(['auth_code', 'coordinator_invite']);
  });

  it('renders and refuses incomplete variables', () => {
    expect(renderTemplate('auth_code', 'en', { code: '123456', minutes: '10' })).toBe(
      '123456 is your Quran Circles code. It works for 10 minutes. Do not share it.',
    );
    expect(() => renderTemplate('auth_code', 'en', { code: '12', minutes: '10' })).toThrow();
    // @ts-expect-error minutes is required
    expect(() => renderTemplate('auth_code', 'ur', { code: '123456' })).toThrow();
  });
});

describe('outbox and push payloads', () => {
  const push = {
    title: 'Reminder',
    body: 'Tuesday circle at 7:30 pm',
    data: {
      type: 'reminder' as const,
      deepLink: buildDeepLink({ type: 'session', sessionId: sid }),
      sessionId: sid,
    },
  };

  it('accepts a push payload and fills defaults', () => {
    expect(PushPayload.parse(push).ttlSeconds).toBe(6 * 3600);
  });

  it('accepts the morning ayah push with a quran deep link, and still refuses unknown push types', () => {
    const deepLink = buildDeepLink({ type: 'quran', surah: 2, ayah: 255 });
    const ayah = {
      title: 'Ayah of the day',
      body: 'Surah 2, ayah 255',
      data: { type: 'ayah_of_the_day' as const, deepLink },
    };
    expect(PushPayload.parse(ayah).data).toEqual({ type: 'ayah_of_the_day', deepLink });
    expect(parseDeepLink(deepLink)).toEqual({ type: 'quran', surah: 2, ayah: 255 });
    expect(OutboxPayload.safeParse({ channel: 'push', push: ayah }).success).toBe(true);
    expect(
      PushPayload.safeParse({ ...ayah, data: { ...ayah.data, type: 'ayah_of_the_week' } }).success,
    ).toBe(false);
  });

  it('accepts push, WhatsApp template and SMS payloads', () => {
    expect(OutboxPayload.safeParse({ channel: 'push', push }).success).toBe(true);
    expect(
      OutboxPayload.safeParse({
        channel: 'whatsapp',
        template: 'auth_code',
        locale: 'ur',
        variables: { code: '123456', minutes: '10' },
      }).success,
    ).toBe(true);
    expect(
      OutboxPayload.safeParse({
        channel: 'sms',
        template: 'auth_code',
        locale: 'en',
        variables: { code: '123456', minutes: '10' },
      }).success,
    ).toBe(true);
  });

  it('rejects the wrong variables, unknown templates and SMS for templates that must not use it', () => {
    expect(
      OutboxPayload.safeParse({
        channel: 'whatsapp',
        template: 'auth_code',
        locale: 'en',
        variables: { code: 'abc' },
      }).success,
    ).toBe(false);
    expect(
      OutboxPayload.safeParse({
        channel: 'whatsapp',
        template: 'made_up',
        locale: 'en',
        variables: {},
      }).success,
    ).toBe(false);
    expect(
      OutboxPayload.safeParse({
        channel: 'sms',
        template: 'session_reminder',
        locale: 'en',
        variables: { sessionTitle: 'a', venueName: 'b', when: 'c', link: 'd' },
      }).success,
    ).toBe(false);
  });

  it('builds idempotency keys', () => {
    expect(outboxKey('reminder', 'o1', 'u1', 'push')).toBe('reminder:o1:u1:push');
  });
});
