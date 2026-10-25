/**
 * The phone's own position, asked for only when the person presses "Use my location" on the map.
 * It centres the map and draws a dot there; it is never sent anywhere or saved.
 * On the web this is the browser's geolocation; phones get it in `location.native.ts`.
 */
export type LocateResult =
  { ok: true; lat: number; lng: number } | { ok: false; reason: 'denied' | 'unavailable' };

export function canLocate(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator && !!navigator.geolocation;
}

export function locate(timeoutMs = 10000): Promise<LocateResult> {
  if (!canLocate()) return Promise.resolve({ ok: false, reason: 'unavailable' });
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ ok: true, lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => resolve({ ok: false, reason: err.code === 1 ? 'denied' : 'unavailable' }),
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 5 * 60 * 1000 },
    );
  });
}
