import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createFakeFetch } from './test/fake-fetch';
import { MessagingConfigError, MessagingEnv, createMessaging } from './env';

const ok = () => createFakeFetch(() => ({ status: 200, body: { messages: [{ id: 'wamid.1' }] } }));
const live = {
  MESSAGING_MODE: 'live',
  WHATSAPP_PHONE_NUMBER_ID: '100200300',
  WHATSAPP_ACCESS_TOKEN: 'test-token',
  RESEND_API_KEY: 're_test_not_a_real_key',
  EMAIL_FROM: 'Quran Circles <codes@mail.example.org>',
};

describe('createMessaging', () => {
  it('defaults to fake providers and test-mode codes', async () => {
    const m = createMessaging({});
    expect(m.mode).toBe('fake');
    expect(m.fakes).toBeDefined();
    await m.codeSender.send({
      phone: '+923000000001',
      code: '123456',
      locale: 'en',
      channel: 'whatsapp',
    });
    expect(m.fakes!.codes.lastCode('+923000000001')).toBe('123456');
  });

  it('refuses fake mode in production', () => {
    expect(() => createMessaging({ APP_ENV: 'production' })).toThrow(MessagingConfigError);
  });

  it('refuses test-mode codes in production even with live providers', () => {
    expect(() =>
      createMessaging({ ...live, APP_ENV: 'production', CODE_DELIVERY_MODE: 'test' }),
    ).toThrow(/Test-mode/);
  });

  it('refuses live code delivery on fake providers', () => {
    expect(() => createMessaging({ CODE_DELIVERY_MODE: 'live' })).toThrow(MessagingConfigError);
  });

  it('live mode needs RESEND_API_KEY or the WhatsApp credentials', () => {
    expect(() => createMessaging({ MESSAGING_MODE: 'live' })).toThrow(/RESEND_API_KEY/);
    expect(() =>
      createMessaging({ MESSAGING_MODE: 'live', WHATSAPP_PHONE_NUMBER_ID: '1' }),
    ).toThrow(MessagingConfigError);
  });

  it('live mode runs email-only: WhatsApp sends fail as not configured', async () => {
    const m = createMessaging(
      { MESSAGING_MODE: 'live', APP_ENV: 'production', RESEND_API_KEY: 're_x' },
      { fetch: ok() },
    );
    expect(m.mode).toBe('live');
    const r = await m.whatsapp.sendTemplate({
      to: '+923001234567',
      templateName: 't',
      language: 'en',
      bodyParams: [],
    });
    expect(r).toMatchObject({ status: 'permanent_failure', code: 'whatsapp_not_configured' });
  });

  it('builds live providers and sends through the injected fetch', async () => {
    const fake = ok();
    const m = createMessaging(
      { ...live, APP_ENV: 'production', WHATSAPP_APP_SECRET: 's', WHATSAPP_VERIFY_TOKEN: 'v' },
      { fetch: fake },
    );
    expect(m.mode).toBe('live');
    expect(m.fakes).toBeUndefined();
    expect(m.webhook).toEqual({ appSecret: 's', verifyToken: 'v' });
    expect(m.sms).toBeUndefined();
    await m.codeSender.send({
      phone: '+923000000001',
      code: '123456',
      locale: 'en',
      channel: 'whatsapp',
    });
    expect(fake.requests).toHaveLength(1);
    expect(fake.requests[0]!.url).toContain('/100200300/messages');
    m.close();
  });

  it('adds SMS only when the gateway is fully configured', () => {
    const fake = ok();
    expect(
      createMessaging({ ...live, SMS_GATEWAY_URL: 'https://sms.test/send' }, { fetch: fake }).sms,
    ).toBeUndefined();
    expect(
      createMessaging(
        { ...live, SMS_GATEWAY_URL: 'https://sms.test/send', SMS_GATEWAY_KEY: 'k' },
        { fetch: fake },
      ).sms,
    ).toBeDefined();
  });

  it('rejects a service-account value that is not a key, without echoing it', () => {
    const secret = 'definitely-not-json-secret';
    try {
      createMessaging({ ...live, FCM_SERVICE_ACCOUNT_JSON: secret }, { fetch: ok() });
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(MessagingConfigError);
      expect((error as Error).message).not.toContain(secret);
    }
  });

  it('defaults the stated code validity to the API code lifetime of 5 minutes (SEC-21)', () => {
    expect(MessagingEnv.parse({}).CODE_VALIDITY_MINUTES).toBe(5);
    expect(MessagingEnv.parse({ CODE_VALIDITY_MINUTES: '7' }).CODE_VALIDITY_MINUTES).toBe(7);
  });

  it('names invalid variables but not their values', () => {
    try {
      createMessaging({ MESSAGING_MODE: 'sometimes', CODE_VALIDITY_MINUTES: '9999' });
      throw new Error('should have thrown');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('MESSAGING_MODE');
      expect(message).toContain('CODE_VALIDITY_MINUTES');
      expect(message).not.toContain('sometimes');
      expect(message).not.toContain('9999');
    }
  });

  it('accepts an APNs key with escaped newlines and uses the injected HTTP/2 fetch', () => {
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const pem = privateKey
      .export({ type: 'pkcs8', format: 'pem' })
      .toString()
      .trim()
      .replace(/\n/g, '\\n');
    let closed = false;
    const http2Fetch = Object.assign(ok(), {
      close: () => {
        closed = true;
      },
    });
    const m = createMessaging(
      {
        ...live,
        APNS_TEAM_ID: 'TEAM123456',
        APNS_KEY_ID: 'KEY1234567',
        APNS_PRIVATE_KEY: pem,
        APNS_BUNDLE_ID: 'test.bundle',
      },
      { fetch: ok(), http2Fetch },
    );
    m.close();
    expect(closed).toBe(true);
  });
});
