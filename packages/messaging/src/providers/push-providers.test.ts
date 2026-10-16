import { createPublicKey, createVerify, generateKeyPairSync, createECDH, randomBytes } from 'node:crypto';
import webpush from 'web-push';
import { describe, expect, it } from 'vitest';
import type { PushPayload } from '@qc/contracts';
import { bodyOf, createFakeFetch } from '../test/fake-fetch';
import { HttpTimeoutError } from '../http';
import { ApnsPushProvider } from './apns';
import { FcmPushProvider, GoogleServiceAccountTokenSource, type AccessTokenSource } from './fcm';
import { PushRouter, type PushProvider } from './push';
import { WebPushProvider } from './webpush';

const SESSION = '00000000-0000-4000-8000-000000000001';
const OCCURRENCE = '00000000-0000-4000-8000-000000000002';

const payload: PushPayload = {
  title: 'Reminder',
  body: 'Weekly tafsir tonight',
  data: {
    type: 'reminder',
    deepLink: `qurancircles://occurrence/${OCCURRENCE}`,
    sessionId: SESSION,
    occurrenceId: OCCURRENCE,
  },
  collapseKey: `reminder:${OCCURRENCE}`,
  ttlSeconds: 3600,
};

const decodeJwt = (jwt: string) => {
  const [h, b, s] = jwt.split('.') as [string, string, string];
  return {
    header: JSON.parse(Buffer.from(h, 'base64url').toString()) as Record<string, unknown>,
    claims: JSON.parse(Buffer.from(b, 'base64url').toString()) as Record<string, unknown>,
    signingInput: `${h}.${b}`,
    signature: Buffer.from(s, 'base64url'),
  };
};

class StaticToken implements AccessTokenSource {
  invalidated = 0;
  getToken() {
    return Promise.resolve('fake-access-token');
  }
  invalidate() {
    this.invalidated++;
  }
}

describe('FCM provider', () => {
  const make = (respond: Parameters<typeof createFakeFetch>[0], auth = new StaticToken()) => {
    const fetch = createFakeFetch(respond);
    return {
      auth,
      fetch,
      provider: new FcmPushProvider({ projectId: 'demo-project', auth, fetch, baseUrl: 'https://fcm.test' }),
    };
  };
  const target = { kind: 'fcm', token: 'fcm-token-1' } as const;

  it('posts the v1 message with data as strings and a collapse key', async () => {
    const { provider, fetch } = make(() => ({ status: 200, body: { name: 'projects/demo/messages/1' } }));
    const result = await provider.send(target, payload);
    expect(result).toEqual({ status: 'ok', providerMessageId: 'projects/demo/messages/1' });
    const request = fetch.requests[0]!;
    expect(request.url).toBe('https://fcm.test/v1/projects/demo-project/messages:send');
    expect(request.init.headers?.authorization).toBe('Bearer fake-access-token');
    const sent = bodyOf(request) as { message: Record<string, any> };
    expect(sent.message.token).toBe('fcm-token-1');
    expect(sent.message.notification).toEqual({ title: 'Reminder', body: 'Weekly tafsir tonight' });
    expect(sent.message.data).toEqual({
      type: 'reminder',
      deepLink: payload.data.deepLink,
      sessionId: SESSION,
      occurrenceId: OCCURRENCE,
    });
    expect(sent.message.android.collapse_key).toBe(`reminder:${OCCURRENCE}`);
    expect(sent.message.android.ttl).toBe('3600s');
  });

  const failures: Array<[string, number, unknown, string, Record<string, string>?]> = [
    ['unregistered', 404, { error: { status: 'NOT_FOUND', details: [{ errorCode: 'UNREGISTERED' }] } }, 'invalid_token'],
    ['sender mismatch', 403, { error: { details: [{ errorCode: 'SENDER_ID_MISMATCH' }] } }, 'invalid_token'],
    ['malformed token', 400, { error: { status: 'INVALID_ARGUMENT', message: 'The registration token is not a valid FCM registration token' } }, 'invalid_token'],
    ['bad payload', 400, { error: { status: 'INVALID_ARGUMENT', message: 'Invalid JSON payload' } }, 'permanent_failure'],
    ['quota', 429, { error: { status: 'RESOURCE_EXHAUSTED', details: [{ errorCode: 'QUOTA_EXCEEDED' }] } }, 'transient_failure', { 'retry-after': '120' }],
    ['unavailable', 503, { error: { status: 'UNAVAILABLE' } }, 'transient_failure'],
    ['expired access token', 401, { error: { status: 'UNAUTHENTICATED' } }, 'transient_failure'],
  ];
  it.each(failures)('classifies %s', async (_name, status, body, expected, headers) => {
    const { provider, auth } = make(() => ({ status, body, ...(headers ? { headers } : {}) }));
    const result = await provider.send(target, payload);
    expect(result.status).toBe(expected);
    if (status === 401) expect(auth.invalidated).toBe(1);
    if (status === 429) expect(result).toMatchObject({ retryAfterMs: 120_000 });
  });

  it('treats a network error as transient', async () => {
    const { provider } = make(() => new Error('socket hang up'));
    expect(await provider.send(target, payload)).toEqual({ status: 'transient_failure', code: 'network_error' });
  });

  it('treats a failed token fetch as transient', async () => {
    const auth: AccessTokenSource = { getToken: () => Promise.reject(new Error('x')), invalidate: () => {} };
    const { provider, fetch } = make(() => ({ status: 200, body: {} }), auth as StaticToken);
    expect(await provider.send(target, payload)).toEqual({ status: 'transient_failure', code: 'fcm_auth_unavailable' });
    expect(fetch.requests).toHaveLength(0);
  });
});

describe('Google service-account token source', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  const credentials = { clientEmail: 'sender@demo.iam.example', privateKey, projectId: 'demo' };

  it('signs an RS256 assertion, exchanges it and caches the token', async () => {
    let now = new Date('2026-11-01T10:00:00Z');
    const fetch = createFakeFetch(() => ({ status: 200, body: { access_token: 'tok-1', expires_in: 3600 } }));
    const source = new GoogleServiceAccountTokenSource(credentials, fetch, {
      tokenUrl: 'https://oauth.test/token',
      now: () => now,
    });
    expect(await source.getToken()).toBe('tok-1');
    expect(await source.getToken()).toBe('tok-1');
    expect(fetch.requests).toHaveLength(1);
    const request = fetch.requests[0]!;
    expect(request.url).toBe('https://oauth.test/token');
    const form = new URLSearchParams(request.init.body as string);
    expect(form.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer');
    const jwt = decodeJwt(form.get('assertion')!);
    expect(jwt.header.alg).toBe('RS256');
    expect(jwt.claims).toMatchObject({
      iss: 'sender@demo.iam.example',
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth.test/token',
    });
    const verifier = createVerify('RSA-SHA256');
    verifier.update(jwt.signingInput);
    expect(verifier.verify(createPublicKey(publicKey), jwt.signature)).toBe(true);

    now = new Date('2026-11-01T11:30:00Z'); // past expiry
    await source.getToken();
    expect(fetch.requests).toHaveLength(2);
  });

  it('throws a fixed error when Google refuses', async () => {
    const fetch = createFakeFetch(() => ({ status: 400, body: { error: 'invalid_grant' } }));
    const source = new GoogleServiceAccountTokenSource(credentials, fetch);
    await expect(source.getToken()).rejects.toThrow('fcm_auth_failed');
  });
});

describe('APNs provider', () => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  const make = (respond: Parameters<typeof createFakeFetch>[0]) => {
    const fetch = createFakeFetch(respond);
    return {
      fetch,
      provider: new ApnsPushProvider({
        teamId: 'TEAM123456',
        keyId: 'KEY1234567',
        privateKey,
        bundleId: 'org.example.qc',
        fetch,
        baseUrl: 'https://apns.test',
        now: () => new Date('2026-11-01T10:00:00Z'),
      }),
    };
  };
  const target = { kind: 'apns', token: 'abcdef0123456789' } as const;

  it('sends an alert with a signed provider token, topic, collapse id and expiry', async () => {
    const { provider, fetch } = make(() => ({ status: 200, headers: { 'apns-id': 'apns-uuid-1' } }));
    expect(await provider.send(target, payload)).toEqual({ status: 'ok', providerMessageId: 'apns-uuid-1' });
    const request = fetch.requests[0]!;
    expect(request.url).toBe('https://apns.test/3/device/abcdef0123456789');
    const headers = request.init.headers!;
    expect(headers['apns-topic']).toBe('org.example.qc');
    expect(headers['apns-push-type']).toBe('alert');
    expect(headers['apns-collapse-id']).toBe(`reminder:${OCCURRENCE}`);
    expect(headers['apns-expiration']).toBe(String(Math.floor(Date.parse('2026-11-01T11:00:00Z') / 1000)));
    const jwt = decodeJwt(headers.authorization!.replace(/^bearer /, ''));
    expect(jwt.header).toMatchObject({ alg: 'ES256', kid: 'KEY1234567' });
    expect(jwt.claims.iss).toBe('TEAM123456');
    const verifier = createVerify('SHA256');
    verifier.update(jwt.signingInput);
    expect(verifier.verify({ key: createPublicKey(publicKey), dsaEncoding: 'ieee-p1363' }, jwt.signature)).toBe(true);
    const body = bodyOf(request) as Record<string, any>;
    expect(body.aps.alert).toEqual({ title: 'Reminder', body: 'Weekly tafsir tonight' });
    expect(body.deepLink).toBe(payload.data.deepLink);
  });

  it('reuses the provider token between sends', async () => {
    const { provider, fetch } = make(() => ({ status: 200 }));
    await provider.send(target, payload);
    await provider.send(target, payload);
    expect(fetch.requests[0]!.init.headers!.authorization).toBe(fetch.requests[1]!.init.headers!.authorization);
  });

  const failures: Array<[string, number, unknown, string]> = [
    ['unregistered', 410, { reason: 'Unregistered' }, 'invalid_token'],
    ['bad token', 400, { reason: 'BadDeviceToken' }, 'invalid_token'],
    ['wrong topic', 400, { reason: 'DeviceTokenNotForTopic' }, 'invalid_token'],
    ['expired provider token', 403, { reason: 'ExpiredProviderToken' }, 'transient_failure'],
    ['too many requests', 429, { reason: 'TooManyRequests' }, 'transient_failure'],
    ['service unavailable', 503, { reason: 'ServiceUnavailable' }, 'transient_failure'],
    ['payload too large', 413, { reason: 'PayloadTooLarge' }, 'permanent_failure'],
  ];
  it.each(failures)('classifies %s', async (_n, status, body, expected) => {
    const { provider } = make(() => ({ status, body }));
    expect((await provider.send(target, payload)).status).toBe(expected);
  });

  it('treats a timeout as transient', async () => {
    const { provider } = make(() => new HttpTimeoutError('slow'));
    expect(await provider.send(target, payload)).toEqual({ status: 'transient_failure', code: 'network_error' });
  });
});

describe('web push provider', () => {
  const vapid = webpush.generateVAPIDKeys();
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  const subscription = {
    endpoint: 'https://push.example.test/send/abc123',
    keys: {
      p256dh: ecdh.getPublicKey().toString('base64url'),
      auth: randomBytes(16).toString('base64url'),
    },
  };
  const token = JSON.stringify(subscription);
  const make = (respond: Parameters<typeof createFakeFetch>[0]) => {
    const fetch = createFakeFetch(respond);
    return {
      fetch,
      provider: new WebPushProvider({
        subject: 'mailto:ops@example.org',
        vapidPublicKey: vapid.publicKey,
        vapidPrivateKey: vapid.privateKey,
        fetch,
      }),
    };
  };
  const target = { kind: 'webpush', token } as const;

  it('encrypts the payload and signs the request with VAPID', async () => {
    const { provider, fetch } = make(() => ({ status: 201 }));
    expect(await provider.send(target, payload)).toEqual({ status: 'ok' });
    const request = fetch.requests[0]!;
    expect(request.url).toBe(subscription.endpoint);
    expect(request.init.method).toBe('POST');
    const headers = request.init.headers!;
    expect(headers['Content-Encoding']).toBe('aes128gcm');
    expect(headers.TTL).toBe('3600');
    expect(headers.Authorization).toMatch(/^vapid t=.+, k=.+$/);
    expect(request.init.body).toBeInstanceOf(Uint8Array);
    // Encrypted: the plain text must not appear in the body.
    expect(Buffer.from(request.init.body as Uint8Array).toString('latin1')).not.toContain('Weekly tafsir');
  });

  it.each([
    [201, 'ok'],
    [404, 'invalid_token'],
    [410, 'invalid_token'],
    [429, 'transient_failure'],
    [503, 'transient_failure'],
    [413, 'permanent_failure'],
    [403, 'permanent_failure'],
  ])('status %i is %s', async (status, expected) => {
    const { provider } = make(() => ({ status }));
    expect((await provider.send(target, payload)).status).toBe(expected);
  });

  it('rejects a token that is not a subscription without calling the network', async () => {
    const { provider, fetch } = make(() => ({ status: 201 }));
    const result = await provider.send({ kind: 'webpush', token: 'not-json-at-all' }, payload);
    expect(result).toEqual({ status: 'invalid_token', code: 'webpush_bad_subscription' });
    expect(fetch.requests).toHaveLength(0);
  });
});

describe('push router', () => {
  it('sends each token through the provider for its transport', async () => {
    const calls: string[] = [];
    const stub = (name: string): PushProvider => ({
      send: () => {
        calls.push(name);
        return Promise.resolve({ status: 'ok' });
      },
    });
    const router = new PushRouter({ fcm: stub('fcm'), apns: stub('apns') });
    await router.send({ kind: 'fcm', token: 't' }, payload);
    await router.send({ kind: 'apns', token: 't' }, payload);
    expect(calls).toEqual(['fcm', 'apns']);
  });

  it('refuses a transport that is not configured, permanently', async () => {
    const router = new PushRouter({});
    expect(await router.send({ kind: 'webpush', token: 't' }, payload)).toEqual({
      status: 'permanent_failure',
      code: 'provider_not_configured',
    });
  });
});
