import { useEffect } from 'react';
import { PushData, parseDeepLink } from '@qc/contracts';
import type { Navigator } from './NavProvider';
import type { Route } from './routes';

/** A server push's data, as the contract defines it (`PushData` has no exported type). */
type PushDataValue = ReturnType<typeof PushData.parse>;
type PushType = PushDataValue['type'];

/**
 * Where tapping a notification takes the person.
 *
 * - A server push (`PushData` from `@qc/contracts`) is read by its `type`. Every type is listed in
 *   the switch below, so a new type in the contract fails the typecheck until it is handled here.
 * - An on-device reminder (scheduled by the app itself) carries only `{ sessionId }` and opens
 *   that session.
 *
 * Anything else, or a payload that does not match, is ignored: a tap then simply opens the app.
 * Feature flags are not read here. A push only arrives when the server allowed it, so a tap on
 * one always opens where it points, even if the flag has been turned off since.
 */
export function pushTapRoute(data: unknown): Route | null {
  const push = PushData.safeParse(data);
  if (push.success) return serverPushRoute(push.data.type, push.data);
  return sessionRoute(data);
}

function serverPushRoute(type: PushType, data: PushDataValue): Route | null {
  switch (type) {
    case 'ayah_of_the_day': {
      const link = parseDeepLink(data.deepLink);
      return link?.type === 'quran'
        ? { name: 'quran', reader: { surah: link.surah, ayah: link.ayah } }
        : null;
    }
    case 'update':
    case 'reminder':
    case 'session_changed':
    case 'session_cancelled':
    case 'waitlist_promoted':
    case 'circle_opened':
      return sessionRoute(data);
    default: {
      const unhandled: never = type;
      return unhandled;
    }
  }
}

function sessionRoute(data: unknown): Route | null {
  if (typeof data !== 'object' || data === null) return null;
  const sessionId: unknown = (data as { sessionId?: unknown }).sessionId;
  return typeof sessionId === 'string' && sessionId.length > 0
    ? { name: 'session', sessionId }
    : null;
}

/** Calls `onTap` with a tapped notification's data; returns a handle that stops listening. */
export type PushTapSource = (onTap: (data: unknown) => void) => { remove(): void };

/** Opens where a tapped notification points. `null` (the web) listens for nothing. */
export function usePushTaps(source: PushTapSource | null, navigator: Navigator): void {
  useEffect(() => {
    if (!source) return;
    const subscription = source((data) => {
      const route = pushTapRoute(data);
      if (route) navigator.go(route);
    });
    return () => subscription.remove();
  }, [source, navigator]);
}
