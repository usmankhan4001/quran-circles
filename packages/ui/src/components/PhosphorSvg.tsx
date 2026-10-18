import { duotoneOpacity, frontPaths, type PhosphorSvgProps } from './phosphor-types';

/**
 * The web drawing: a plain `<svg>` (react-native-web renders through react-dom). iOS and Android
 * use `PhosphorSvg.native.tsx`, which draws the same paths with react-native-svg.
 */
export function PhosphorSvg({ glyph, weight, size, color }: PhosphorSvgProps) {
  const front = frontPaths(glyph, weight);
  return (
    <svg
      viewBox="0 0 256 256"
      width={size}
      height={size}
      fill="currentColor"
      style={{ color, display: 'block' }}
      aria-hidden="true"
      focusable="false"
    >
      {weight === 'duotone'
        ? glyph.duotone.map((d) => <path key={`b${d}`} d={d} opacity={duotoneOpacity} />)
        : null}
      {front.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
