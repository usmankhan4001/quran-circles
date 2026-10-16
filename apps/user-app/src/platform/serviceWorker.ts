import { Platform } from 'react-native';

/**
 * Registers the offline shell on the web target. The worker caches the app's own files so the
 * page opens without a connection; it never touches API calls (see `public/sw.js`).
 */
export function registerServiceWorker(): void {
  if (Platform.OS !== 'web') return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  if (process.env.NODE_ENV === 'development') return;
  const register = () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
