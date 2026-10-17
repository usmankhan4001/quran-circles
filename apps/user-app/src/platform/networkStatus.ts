import { Platform } from 'react-native';
import type { NetworkStatusSource } from '../core/connectivity';

/** The parts of `window` the browser source needs; tests pass a fake. */
export interface BrowserNetworkTarget {
  navigator?: { onLine?: boolean };
  addEventListener(type: 'online' | 'offline', listener: () => void): void;
  removeEventListener(type: 'online' | 'offline', listener: () => void): void;
}

/**
 * The browser's connection state: `navigator.onLine` and the `online` and `offline` events.
 * `onLine` false is reliable (no network at all); true only means "maybe", so failed calls
 * still mark the app offline on their own.
 */
export function browserNetworkStatus(target: BrowserNetworkTarget): NetworkStatusSource {
  const isOnline = () => target.navigator?.onLine !== false;
  return {
    isOnline,
    subscribe(listener) {
      const onOnline = () => listener(true);
      const onOffline = () => listener(false);
      target.addEventListener('online', onOnline);
      target.addEventListener('offline', onOffline);
      return () => {
        target.removeEventListener('online', onOnline);
        target.removeEventListener('offline', onOffline);
      };
    },
  };
}

/**
 * The device's connection state, where the platform offers one. On the web target that is the
 * browser's. The native apps have no network-status module installed, so they return null and
 * rely on failed calls alone.
 */
export function deviceNetworkStatus(): NetworkStatusSource | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  return browserNetworkStatus(window);
}
