import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { Locale } from '@qc/contracts';
import type { PushRegistrar, PushRegistration } from '../features/reminders/types';

/** FCM on Android and APNs on iOS, through the device token. No third-party push service. */
export class NativePushRegistrar implements PushRegistrar {
  isSupported(): boolean {
    return Platform.OS === 'ios' || Platform.OS === 'android';
  }

  async register(_locale: Locale): Promise<PushRegistration | 'denied' | 'unsupported'> {
    if (!this.isSupported()) return 'unsupported';
    let status = await Notifications.getPermissionsAsync();
    if (!status.granted && status.canAskAgain)
      status = await Notifications.requestPermissionsAsync();
    if (!status.granted) return 'denied';
    const token = await Notifications.getDevicePushTokenAsync();
    return {
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      provider: Platform.OS === 'ios' ? 'apns' : 'fcm',
      token: String(token.data),
    };
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Web push for the PWA, through the browser's Push API and our own service worker. It needs
 * the public VAPID key; without it web push stays off. On iPhone it only works after the
 * page has been added to the Home Screen.
 */
export class WebPushRegistrar implements PushRegistrar {
  constructor(private readonly vapidPublicKey: string) {}

  isSupported(): boolean {
    return (
      Platform.OS === 'web' &&
      this.vapidPublicKey !== '' &&
      typeof navigator !== 'undefined' &&
      'serviceWorker' in navigator &&
      typeof PushManager !== 'undefined' &&
      typeof Notification !== 'undefined'
    );
  }

  async register(_locale: Locale): Promise<PushRegistration | 'denied' | 'unsupported'> {
    if (!this.isSupported()) return 'unsupported';
    const permission =
      Notification.permission === 'default'
        ? await Notification.requestPermission()
        : Notification.permission;
    if (permission !== 'granted') return 'denied';
    const registration = await navigator.serviceWorker.ready;
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(this.vapidPublicKey),
      }));
    return { platform: 'web', provider: 'webpush', token: JSON.stringify(subscription.toJSON()) };
  }
}

export function createPushRegistrar(vapidPublicKey: string): PushRegistrar {
  return Platform.OS === 'web' ? new WebPushRegistrar(vapidPublicKey) : new NativePushRegistrar();
}
