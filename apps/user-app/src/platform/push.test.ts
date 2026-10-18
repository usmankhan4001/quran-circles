import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeviceRegister, parseWebPushToken } from '@qc/contracts';
import { WebPushRegistrar } from './push';

vi.mock('expo-notifications', () => ({}));

// A made-up VAPID public key: any URL-safe base64 string decodes, and nothing is sent.
const FAKE_VAPID_KEY = 'ZmFrZS12YXBpZC1rZXk';

/** What a real browser's `PushSubscription.toJSON()` returns, with made-up values. */
function fakeSubscription(endpoint: string) {
  return {
    toJSON: () => ({
      endpoint,
      expirationTime: null,
      keys: { p256dh: 'fake-p256dh', auth: 'fake-auth' },
    }),
  };
}

function installBrowser(options: {
  permission: NotificationPermission;
  existing?: ReturnType<typeof fakeSubscription> | null;
  created?: ReturnType<typeof fakeSubscription>;
}) {
  const subscribe = vi.fn(async () => options.created);
  const getSubscription = vi.fn(async () => options.existing ?? null);
  vi.stubGlobal('PushManager', class {});
  vi.stubGlobal('Notification', {
    permission: options.permission,
    requestPermission: vi.fn(async () => options.permission),
  });
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { ready: Promise.resolve({ pushManager: { getSubscription, subscribe } }) },
  });
  return { subscribe, getSubscription };
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete (navigator as { serviceWorker?: unknown }).serviceWorker;
});

describe('WebPushRegistrar', () => {
  it('registers the browser subscription as a token the contract accepts', async () => {
    const browser = installBrowser({
      permission: 'granted',
      created: fakeSubscription('https://fcm.googleapis.com/fcm/send/fake-endpoint-id'),
    });
    const result = await new WebPushRegistrar(FAKE_VAPID_KEY).register('en');
    expect(browser.subscribe).toHaveBeenCalledTimes(1);
    if (typeof result === 'string') throw new Error(`expected a registration, got ${result}`);
    expect(result).toMatchObject({ platform: 'web', provider: 'webpush' });
    expect(parseWebPushToken(result.token)?.endpoint).toBe(
      'https://fcm.googleapis.com/fcm/send/fake-endpoint-id',
    );
    expect(DeviceRegister.safeParse({ ...result, locale: 'en' }).success).toBe(true);
  });

  it('reuses an existing subscription instead of making a new one', async () => {
    const browser = installBrowser({
      permission: 'granted',
      existing: fakeSubscription('https://updates.push.services.mozilla.com/wpush/v2/fake-id'),
    });
    const result = await new WebPushRegistrar(FAKE_VAPID_KEY).register('ur');
    expect(browser.subscribe).not.toHaveBeenCalled();
    if (typeof result === 'string') throw new Error(`expected a registration, got ${result}`);
    expect(DeviceRegister.safeParse({ ...result, locale: 'ur' }).success).toBe(true);
  });

  it('returns denied and subscribes to nothing when the person refuses', async () => {
    const browser = installBrowser({ permission: 'denied' });
    expect(await new WebPushRegistrar(FAKE_VAPID_KEY).register('en')).toBe('denied');
    expect(browser.getSubscription).not.toHaveBeenCalled();
    expect(browser.subscribe).not.toHaveBeenCalled();
  });

  it('is unsupported without a VAPID key', async () => {
    installBrowser({ permission: 'granted' });
    const registrar = new WebPushRegistrar('');
    expect(registrar.isSupported()).toBe(false);
    expect(await registrar.register('en')).toBe('unsupported');
  });
});
