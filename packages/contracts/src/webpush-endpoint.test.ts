import { describe, expect, it } from 'vitest';
import {
  DeviceRegister,
  WEB_PUSH_HOSTS,
  isAllowedWebPushEndpoint,
  parseWebPushToken,
} from './schemas/people';

// SEC-01: a web push token's endpoint is fetched by the worker, so only known push services pass.

const KEYS = { p256dh: 'BOr1Ld7bZ6qz-fake-p256dh-key', auth: 'fake-auth-secret' };
const token = (endpoint: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ endpoint, expirationTime: null, keys: KEYS, ...extra });
const register = (over: Record<string, unknown>) =>
  DeviceRegister.safeParse({ platform: 'web', provider: 'webpush', locale: 'en', ...over });

describe('isAllowedWebPushEndpoint', () => {
  it.each([
    'https://fcm.googleapis.com/fcm/send/abc123',
    'https://fcm.googleapis.com:443/wp/abc123',
    'https://updates.push.services.mozilla.com/wpush/v2/abc',
    'https://autopush.push.services.mozilla.com/wpush/v1/abc',
    'https://wns2-par02p.notify.windows.com/w/?token=abc',
    'https://web.push.apple.com/QGx-abc',
    'https://api.push.apple.com/3/device/abc',
    'https://FCM.GoogleAPIs.com/fcm/send/abc',
  ])('allows %s', (endpoint) => {
    expect(isAllowedWebPushEndpoint(endpoint)).toBe(true);
  });

  it.each([
    ['plain http', 'http://fcm.googleapis.com/fcm/send/abc'],
    ['another scheme', 'ftp://fcm.googleapis.com/abc'],
    ['an internal service name', 'https://poster-renderer:8090/render'],
    ['the API container', 'https://api/v1/auth/code'],
    ['localhost', 'https://localhost/x'],
    ['a cloud metadata IP', 'https://169.254.169.254/latest/meta-data/'],
    ['a private IPv4', 'https://10.0.0.5/x'],
    ['a loopback IPv4 in hex', 'https://0x7f.1/x'],
    ['an integer IPv4', 'https://2130706433/x'],
    ['an IPv6 literal', 'https://[::1]/x'],
    ['an IPv6 mapped IPv4', 'https://[::ffff:169.254.169.254]/x'],
    ['a look-alike suffix', 'https://fcm.googleapis.com.evil.example/x'],
    ['a host that only ends with the text', 'https://evilnotify.windows.com/x'],
    ['the bare suffix', 'https://push.apple.com/x'],
    ['a trailing dot', 'https://fcm.googleapis.com./x'],
    ['an unknown host', 'https://push.example.test/send/abc123'],
    ['a non-default port', 'https://fcm.googleapis.com:8443/x'],
    ['user info', 'https://user:pw@fcm.googleapis.com/x'],
    ['user info hiding the real host', 'https://fcm.googleapis.com@10.0.0.5/x'],
    ['not a URL', 'fcm.googleapis.com/fcm/send/abc'],
    ['an over-long URL', `https://fcm.googleapis.com/${'a'.repeat(2100)}`],
  ])('refuses %s', (_name, endpoint) => {
    expect(isAllowedWebPushEndpoint(endpoint)).toBe(false);
  });

  it('every exact host is itself allowed', () => {
    for (const host of WEB_PUSH_HOSTS) {
      expect(isAllowedWebPushEndpoint(`https://${host}/x`)).toBe(true);
    }
  });
});

describe('parseWebPushToken', () => {
  it('reads a PushSubscription as the browser serialises it', () => {
    expect(parseWebPushToken(token('https://fcm.googleapis.com/fcm/send/abc'))).toEqual({
      endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
      keys: KEYS,
    });
  });

  it.each([
    ['not JSON', 'not-json-at-all'],
    ['no keys', JSON.stringify({ endpoint: 'https://fcm.googleapis.com/x' })],
    ['an empty key', token('https://fcm.googleapis.com/x', { keys: { p256dh: '', auth: 'a' } })],
    ['a refused endpoint', token('http://169.254.169.254/latest/meta-data/')],
    ['a JSON string', JSON.stringify('https://fcm.googleapis.com/x')],
  ])('returns null for %s', (_name, value) => {
    expect(parseWebPushToken(value)).toBeNull();
  });
});

describe('DeviceRegister', () => {
  it('accepts a web push subscription on an allowed service', () => {
    expect(register({ token: token('https://web.push.apple.com/QGx-abc') }).success).toBe(true);
  });

  it.each([
    ['an internal endpoint', token('https://poster-renderer:8090/render')],
    ['an http endpoint', token('http://fcm.googleapis.com/fcm/send/abc')],
    ['an IP endpoint', token('https://169.254.169.254/latest/meta-data/')],
    ['a token that is not a subscription', 'e2e-fake-webpush-token'],
  ])('refuses a web push token with %s, on the token field', (_name, value) => {
    const result = register({ token: value });
    expect(result.success).toBe(false);
    expect(result.error?.issues).toEqual([
      expect.objectContaining({ code: 'custom', path: ['token'] }),
    ]);
  });

  it('leaves FCM and APNs tokens alone, which the worker never treats as URLs', () => {
    expect(
      register({ platform: 'android', provider: 'fcm', token: 'fcm-token-abcdef' }).success,
    ).toBe(true);
    expect(register({ platform: 'ios', provider: 'apns', token: 'a1b2c3d4e5f60718' }).success).toBe(
      true,
    );
  });

  it('still applies the length rule to every provider', () => {
    expect(register({ provider: 'fcm', platform: 'android', token: 'short' }).success).toBe(false);
  });
});
