/**
 * Public configuration only. Anything here ships inside the app and the web page, so it must
 * be safe for anyone to read: addresses and restricted public keys, never secrets.
 */
export interface AppEnv {
  apiUrl: string;
  /** Restricted by app id and web origin in the Google console. Empty means the list-only map. */
  googleMapsKey: string;
  /** The public half of the web push key pair. Empty disables web push. */
  vapidPublicKey: string;
}

export function readEnv(): AppEnv {
  return {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4010',
    googleMapsKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
    vapidPublicKey: process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY ?? '',
  };
}
