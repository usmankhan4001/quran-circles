import { useCallback } from 'react';
import type { TextStyle } from 'react-native';
import { useTheme, type TypeRole } from '@qc/ui';

/**
 * Text at the exact size of the showcase artboards (D17 override): a pixel size from the
 * artboard, grown with the chosen text size, with the line height the role keeps for the
 * script (Nastaliq and the Quran font need more room than Latin).
 */
export function useArtSize(): (px: number, role?: TypeRole, script?: 'quran') => TextStyle {
  const theme = useTheme();
  return useCallback(
    (px, role = 'body', script) => {
      const resolved = script ?? theme.script;
      const t = theme.type(role, resolved);
      // Nastaliq reads smaller than Latin at the same size, so Urdu text is set a step larger.
      const size = Math.round(px * theme.scale * (resolved === 'urdu' ? 1.15 : 1));
      return { fontSize: size, lineHeight: Math.round((size * t.lineHeight) / t.fontSize) };
    },
    [theme],
  );
}
