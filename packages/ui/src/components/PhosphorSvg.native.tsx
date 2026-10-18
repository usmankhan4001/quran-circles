import Svg, { Path } from 'react-native-svg';
import { duotoneOpacity, frontPaths, type PhosphorSvgProps } from './phosphor-types';

/** The iOS and Android drawing of a Phosphor glyph, with react-native-svg. */
export function PhosphorSvg({ glyph, weight, size, color }: PhosphorSvgProps) {
  const front = frontPaths(glyph, weight);
  return (
    <Svg viewBox="0 0 256 256" width={size} height={size}>
      {weight === 'duotone'
        ? glyph.duotone.map((d) => (
            <Path key={`b${d}`} d={d} fill={color} opacity={duotoneOpacity} />
          ))
        : null}
      {front.map((d) => (
        <Path key={d} d={d} fill={color} />
      ))}
    </Svg>
  );
}
