import { StyleSheet, View, type ViewStyle } from 'react-native';
import { iconFlipTransform } from '../direction';
import { useTheme } from '../theme';
import { Text } from './Text';

/**
 * A small set of icons drawn with views, so the kit needs no icon font or SVG library.
 * Names that point somewhere (`chevron-forward`, `arrow-back`) mirror in right-to-left.
 */
export type IconName =
  | 'chevron-forward'
  | 'chevron-back'
  | 'chevron-down'
  | 'chevron-up'
  | 'check'
  | 'close'
  | 'plus'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'search';

export const iconNames: readonly IconName[] = [
  'chevron-forward',
  'chevron-back',
  'chevron-down',
  'chevron-up',
  'check',
  'close',
  'plus',
  'info',
  'success',
  'warning',
  'error',
  'search',
];

export interface IconProps {
  name: IconName;
  /** Size in dp. Default 24. Icons scale with the text size, so the caller does not. */
  size?: number;
  /** A colour from the current theme. Defaults to the text colour. */
  color?: string;
  /** Icons are decorative unless given a label. */
  accessibilityLabel?: string;
}

// The drawing below is physical on purpose: shapes are drawn once, then mirrored as a whole by
// `iconFlipTransform` when the direction asks for it.
const s = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
});

function Chevron({ size, color, rotate }: { size: number; color: string; rotate: string }) {
  const side = size * 0.42;
  const stroke = Math.max(2, Math.round(size / 10));
  return (
    <View
      style={{
        width: side,
        height: side,
        borderRightWidth: stroke,
        borderBottomWidth: stroke,
        borderColor: color,
        transform: [{ rotate }],
      }}
    />
  );
}

function Bar({
  size,
  color,
  rotate,
  vertical,
}: {
  size: number;
  color: string;
  rotate?: string;
  vertical?: boolean;
}) {
  const stroke = Math.max(2, Math.round(size / 10));
  const style: ViewStyle = {
    position: 'absolute',
    backgroundColor: color,
    borderRadius: stroke,
    width: vertical ? stroke : size * 0.7,
    height: vertical ? size * 0.7 : stroke,
    transform: rotate ? [{ rotate }] : undefined,
  };
  return <View style={style} />;
}

function Check({ size, color }: { size: number; color: string }) {
  const stroke = Math.max(2, Math.round(size / 10));
  return (
    <View
      style={{
        width: size * 0.32,
        height: size * 0.58,
        borderRightWidth: stroke,
        borderBottomWidth: stroke,
        borderColor: color,
        transform: [{ rotate: '45deg' }, { translateY: -size * 0.04 }],
      }}
    />
  );
}

function Badge({ size, color, glyph }: { size: number; color: string; glyph: string }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: Math.max(2, Math.round(size / 12)),
        borderColor: color,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        decorative
        lang="en"
        direction="ltr"
        align="center"
        style={{ color, fontSize: size * 0.58, lineHeight: size * 0.7, fontWeight: '700' }}
      >
        {glyph}
      </Text>
    </View>
  );
}

export function Icon({ name, size = 24, color, accessibilityLabel }: IconProps) {
  const theme = useTheme();
  const tint = color ?? theme.colors.text;
  const flip = iconFlipTransform(name, theme.direction);
  let art;
  switch (name) {
    case 'chevron-forward':
      art = <Chevron size={size} color={tint} rotate="-45deg" />;
      break;
    case 'chevron-back':
      art = <Chevron size={size} color={tint} rotate="135deg" />;
      break;
    case 'chevron-down':
      art = <Chevron size={size} color={tint} rotate="45deg" />;
      break;
    case 'chevron-up':
      art = <Chevron size={size} color={tint} rotate="225deg" />;
      break;
    case 'check':
      art = <Check size={size} color={tint} />;
      break;
    case 'close':
      art = (
        <>
          <Bar size={size} color={tint} rotate="45deg" />
          <Bar size={size} color={tint} rotate="-45deg" />
        </>
      );
      break;
    case 'plus':
      art = (
        <>
          <Bar size={size} color={tint} />
          <Bar size={size} color={tint} vertical />
        </>
      );
      break;
    case 'info':
      art = <Badge size={size} color={tint} glyph="i" />;
      break;
    case 'warning':
      art = <Badge size={size} color={tint} glyph="!" />;
      break;
    case 'error':
      art = <Badge size={size} color={tint} glyph={'×'} />;
      break;
    case 'success':
      art = (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: Math.max(2, Math.round(size / 12)),
            borderColor: tint,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Check size={size * 0.62} color={tint} />
        </View>
      );
      break;
    case 'search': {
      const stroke = Math.max(2, Math.round(size / 10));
      const ring = size * 0.58;
      art = (
        <>
          <View
            style={{
              position: 'absolute',
              top: size * 0.12,
              left: size * 0.12,
              width: ring,
              height: ring,
              borderRadius: ring / 2,
              borderWidth: stroke,
              borderColor: tint,
            }}
          />
          <View
            style={{
              position: 'absolute',
              width: size * 0.3,
              height: stroke,
              borderRadius: stroke,
              backgroundColor: tint,
              top: size * 0.74,
              left: size * 0.6,
              transform: [{ rotate: '45deg' }],
            }}
          />
        </>
      );
      break;
    }
  }
  return (
    <View
      testID={`icon-${name}`}
      role={accessibilityLabel ? 'img' : undefined}
      aria-label={accessibilityLabel}
      aria-hidden={accessibilityLabel ? undefined : true}
      style={[s.box, { width: size, height: size }, flip]}
    >
      {art}
    </View>
  );
}
