/**
 * Font loading that never blocks for long and never rejects. Shared by `@qc/ui/font-sources`
 * (iOS and Android) and `@qc/ui/web-fonts` (the web), and kept apart from both so neither pulls
 * in the other's font files.
 */
/** How long an app waits for the fonts before it draws anyway, with fallback fonts. */
export const fontLoadTimeoutMs = 3000;

export type FontLoadResult = 'loaded' | 'failed' | 'timedOut';

/**
 * Runs a font loader (in the apps, `expo-font`'s `loadAsync` with `bundledFonts`) but never
 * blocks for longer than `timeoutMs` and never rejects: a font that fails or is slow falls back
 * to the next font in the stack (web) or the system font (iOS, Android).
 */
export function loadFontsWithFallback(
  load: () => Promise<unknown>,
  timeoutMs: number = fontLoadTimeoutMs,
): Promise<FontLoadResult> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: FontLoadResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => finish('timedOut'), timeoutMs);
    try {
      load().then(
        () => finish('loaded'),
        () => finish('failed'),
      );
    } catch {
      finish('failed');
    }
  });
}
