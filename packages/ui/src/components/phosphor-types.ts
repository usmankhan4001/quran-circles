import type { PhosphorGlyph } from './phosphor-glyphs';

/** Which layers of a glyph to draw: one of Phosphor's four weights. */
export type IconWeight = 'regular' | 'bold' | 'fill' | 'duotone';

export interface PhosphorSvgProps {
  glyph: PhosphorGlyph;
  weight: IconWeight;
  size: number;
  /** Any CSS colour, including a `var()` on the web. */
  color: string;
}

/** The share of the colour the back layer of a duotone icon gets, as in Phosphor. */
export const duotoneOpacity = 0.2;

/** The paths of the line (front) layer for a weight. */
export function frontPaths(glyph: PhosphorGlyph, weight: IconWeight): readonly string[] {
  return weight === 'duotone' ? glyph.duotoneFront : glyph[weight];
}
