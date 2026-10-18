import { useMemo } from 'react';
import type { TextStyle } from 'react-native';
import { useTheme } from '@qc/ui';

export type TextWeight = '400' | '500' | '600' | '700' | '800';

/** A weight (and tracking) other than the kit role's own; `lang: 'en'` for Latin text in Urdu. */
export type WeightStyle = (
  weight: TextWeight,
  options?: { lang?: 'en'; letterSpacing?: number },
) => TextStyle;

/**
 * The D17 artboards set some text in a weight the kit role does not use (an 800 title, a 500
 * prayer name). Sizes always come from the kit roles; this only changes the weight, and leaves
 * Urdu alone, as Nastaliq has one weight and a synthesised bold looks broken.
 */
export function useTextWeight(): WeightStyle {
  const theme = useTheme();
  return useMemo<WeightStyle>(() => {
    const urduScreen = theme.script === 'urdu';
    return (weight, options) => {
      if (urduScreen && options?.lang !== 'en') return {};
      return {
        fontWeight: weight,
        ...(options?.letterSpacing !== undefined ? { letterSpacing: options.letterSpacing } : {}),
      };
    };
  }, [theme.script]);
}
