import { describe, expect, it } from 'vitest';
import { createFakeFetch, bodyOf } from './test/fake-fetch';
import { HttpSmsProvider } from './providers/http-sms';
import { FakePushProvider, FakeSmsProvider, FakeWhatsAppProvider } from './fakes';

describe('HTTP SMS provider', () => {
  const make = (respond: Parameters<typeof createFakeFetch>[0]) => {
    const fetch = createFakeFetch(respond);
    return {
      fetch,
      provider: new HttpSmsProvider({
        url: 'https://sms.test/send',
        apiKey: 'k',
        sender: 'QC',
        fetch,
      }),
    };
  };

  it('posts JSON with a bearer key', async () => {
    const { provider, fetch } = make(() => ({ status: 200, body: { id: 'm-1' } }));
    expect(await provider.send({ to: '+923000000001', body: 'hello' })).toEqual({
      status: 'ok',
      providerMessageId: 'm-1',
    });
    expect(fetch.requests[0]!.init.headers!.authorization).toBe('Bearer k');
    expect(bodyOf(fetch.requests[0]!)).toEqual({
      to: '+923000000001',
      text: 'hello',
      sender: 'QC',
    });
  });

  it.each([
    [429, 'transient_failure'],
    [503, 'transient_failure'],
    [400, 'permanent_failure'],
    [401, 'permanent_failure'],
  ])('status %i is %s', async (status, expected) => {
    const { provider } = make(() => ({ status }));
    expect((await provider.send({ to: '+923000000001', body: 'x' })).status).toBe(expected);
  });

  it('treats a network error as transient', async () => {
    const { provider } = make(() => new Error('down'));
    expect(await provider.send({ to: '+923000000001', body: 'x' })).toEqual({
      status: 'transient_failure',
      code: 'network_error',
    });
  });
});

describe('fake providers', () => {
  const payload = {
    title: 't',
    body: 'b',
    data: { type: 'update' as const, deepLink: 'qurancircles://updates' },
    ttlSeconds: 3600,
  };

  it('record sends and answer ok by default', async () => {
    const push = new FakePushProvider();
    const wa = new FakeWhatsAppProvider();
    const sms = new FakeSmsProvider();
    expect((await push.send({ kind: 'fcm', token: 'a' }, payload)).status).toBe('ok');
    expect(
      (
        await wa.sendTemplate({
          to: '+923000000001',
          templateName: 'x',
          language: 'en',
          bodyParams: [],
        })
      ).status,
    ).toBe('ok');
    expect((await sms.send({ to: '+923000000001', body: 'x' })).status).toBe('ok');
    expect(push.sent).toHaveLength(1);
    expect(wa.sent).toHaveLength(1);
    expect(sms.sent).toHaveLength(1);
  });

  it('simulate transient and permanent failures a set number of times', async () => {
    const wa = new FakeWhatsAppProvider();
    wa.failNext({ status: 'transient_failure', code: 'a' }, 2).failNext({
      status: 'permanent_failure',
      code: 'b',
      cause: 'other',
    });
    const req = { to: '+923000000001', templateName: 'x', language: 'en', bodyParams: [] };
    expect((await wa.sendTemplate(req)).status).toBe('transient_failure');
    expect((await wa.sendTemplate(req)).status).toBe('transient_failure');
    expect((await wa.sendTemplate(req)).status).toBe('permanent_failure');
    expect((await wa.sendTemplate(req)).status).toBe('ok');
  });

  it('report an invalid token until reset', async () => {
    const push = new FakePushProvider().invalidateToken('dead');
    expect(await push.send({ kind: 'apns', token: 'dead' }, payload)).toMatchObject({
      status: 'invalid_token',
    });
    expect((await push.send({ kind: 'apns', token: 'alive' }, payload)).status).toBe('ok');
    expect(push.sent).toHaveLength(2);
  });

  it('can be scripted per request', async () => {
    const push = new FakePushProvider().respondWith((r) =>
      r.target.token === 'slow' ? { status: 'transient_failure', code: 'x' } : undefined,
    );
    expect((await push.send({ kind: 'fcm', token: 'slow' }, payload)).status).toBe(
      'transient_failure',
    );
    expect((await push.send({ kind: 'fcm', token: 'fast' }, payload)).status).toBe('ok');
  });
});
