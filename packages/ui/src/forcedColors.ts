import { useEffect, useState } from 'react';
import { Platform, type ViewStyle } from 'react-native';

/**
 * Forced colours (Windows high contrast) on the web target. The browser repaints every
 * background as the page colour and every text and border in its own system colours. The kit's
 * icons are drawn with views, many of them from backgrounds, so they vanished or lost their shape
 * (A-07 in docs/quality/accessibility-rtl.md). While forced colours are on, icon art opts out of
 * the repaint and is drawn in the system text colour instead, which the browser guarantees
 * against the page colour. Phones have no forced colours, so this is web only.
 */
const QUERY = '(forced-colors: active)';

/**
 * CSS system colours (CSS Color 4) that forced colours guarantee to contrast. Each is written as
 * a `var()` with the system colour as its fallback: react-native-web passes `var()` through
 * untouched but drops colour names it does not know, such as `CanvasText`.
 */
export const systemColors = {
  /** Text on the page colour. */
  text: 'var(--qc-system-text, CanvasText)',
} as const;

/** Lets a view keep the colours the kit gives it while forced colours are on (web only). */
export const keepColorsInForcedMode = { forcedColorAdjust: 'none' } as ViewStyle;

function forcedColorsQuery(): MediaQueryList | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  if (typeof window.matchMedia !== 'function') return null;
  try {
    return window.matchMedia(QUERY);
  } catch {
    return null;
  }
}

/** Whether forced colours are on right now. Always false on a phone. */
export function forcedColorsActive(): boolean {
  return forcedColorsQuery()?.matches ?? false;
}

/** Follows forced colours as the person turns them on and off. Always false on a phone. */
export function useForcedColors(): boolean {
  const [active, setActive] = useState(forcedColorsActive);
  useEffect(() => {
    const query = forcedColorsQuery();
    if (!query) return undefined;
    const update = () => setActive(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return active;
}
