import { View } from 'react-native';
import { Icon, keepColorsInForcedMode, systemColors, useForcedColors, type IconName } from '@qc/ui';

/**
 * The line icon the kit does not have yet (chat), drawn with views so the
 * app needs no icon font or SVG library. Everything else comes from the kit's `Icon` line set
 * through `AppIcon`. They are decoration: every button that uses
 * one carries its own name for a screen reader. None of them points anywhere, so none flips in
 * right-to-left.
 * TODO(kit): replace with the kit's icon set once it has these names.
 */
export type GlyphName = 'chat';

/** Any icon the app draws: the kit's line set, or the one the kit does not have yet. */
export type AppIconName = IconName | GlyphName;

const glyphNames: ReadonlySet<string> = new Set<GlyphName>(['chat']);

export const isGlyphName = (name: AppIconName): name is GlyphName => glyphNames.has(name);

export interface GlyphProps {
  name: GlyphName;
  /** A colour from the current theme. */
  color: string;
  /** Size in dp. Default 24. */
  size?: number;
}

function Bar({ w, h, color, style }: { w: number; h: number; color: string; style?: object }) {
  return (
    <View
      style={[{ width: w, height: h, borderRadius: h / 2, backgroundColor: color }, style as never]}
    />
  );
}

export function Glyph({ name, color: themed, size = 24 }: GlyphProps) {
  // Drawn from backgrounds and borders, which forced colours (web) repaint: keep the drawing and
  // use the system text colour, as the kit's Icon does (A-07).
  const forced = useForcedColors();
  const color = forced ? systemColors.text : themed;
  const stroke = Math.max(2, Math.round(size / 12));
  let art;
  switch (name) {
    case 'chat':
      art = (
        <View
          style={{
            width: size * 0.9,
            height: size * 0.68,
            borderRadius: size * 0.2,
            borderWidth: stroke,
            borderColor: color,
            alignItems: 'center',
            justifyContent: 'center',
            gap: size * 0.1,
          }}
        >
          <Bar w={size * 0.5} h={stroke} color={color} />
          <Bar
            w={size * 0.32}
            h={stroke}
            color={color}
            style={{ alignSelf: 'flex-start', marginStart: size * 0.18 }}
          />
        </View>
      );
      break;
  }
  return (
    <View
      aria-hidden
      testID={`glyph-${name}`}
      style={[
        { width: size, height: size, alignItems: 'center', justifyContent: 'center' },
        forced ? keepColorsInForcedMode : null,
      ]}
    >
      {art}
    </View>
  );
}

export interface AppIconProps {
  name: AppIconName;
  /** A colour from the current theme. */
  color: string;
  /** Size in dp. Default 24. */
  size?: number;
}

/** The kit's `Icon` when it has the name, else the local drawing. */
export function AppIcon({ name, color, size = 24 }: AppIconProps) {
  return isGlyphName(name) ? (
    <Glyph name={name} color={color} size={size} />
  ) : (
    <Icon name={name} color={color} size={size} />
  );
}
