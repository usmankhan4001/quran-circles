import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import type { FontFamilyDefinition } from 'expo-font';
import { loadAppFonts } from './appFonts';

/**
 * Holds the first frame until the bundled fonts are ready, so screens do not redraw in a new
 * font. It never holds for long: loading stops waiting after a few seconds and a failure lets
 * the app draw at once with fallback fonts.
 */
export function FontGate({
  load,
  timeoutMs,
  children,
}: {
  /** `Font.loadAsync` from `expo-font`; tests pass a fake. */
  load: (families: FontFamilyDefinition[]) => Promise<void>;
  timeoutMs?: number;
  children: ReactNode;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    void loadAppFonts(load, timeoutMs).then(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
    };
  }, [load, timeoutMs]);
  if (!ready) return <View testID="fonts-loading" style={{ flex: 1 }} />;
  return <>{children}</>;
}
