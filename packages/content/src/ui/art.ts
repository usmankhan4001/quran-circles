import { useCallback } from 'react';
import type { TextStyle } from 'react-native';
import { useTheme, type TypeRole } from '@qc/ui';

/**
 * Quran text at the artboards' sizes (17 to 21 px in lists and verse cards; the kit's `quran`
 * role is 28, for full reading). Grown with the chosen text size, with the role's line height.
 * Everything else uses the kit type roles, which copy the artboards (D17).
 * TODO(ui lane): a smaller Quran role (such as `quranCompact`) would replace this.
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
