import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { iconFlipTransform } from '../direction';
import { keepColorsInForcedMode, systemColors, useForcedColors } from '../forcedColors';
import { useTheme } from '../theme';
import { Text } from './Text';

/**
 * A small set of icons drawn with views, so the kit needs no icon font or SVG library.
 * Names that point somewhere (`chevron-forward`, `arrow-back`) mirror in right-to-left.
 * The object icons from `home` on are the drawings' line set (D12), so apps need no glyphs of
 * their own.
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
  | 'search'
  | 'home'
  | 'pin'
  | 'book'
  | 'calendar'
  | 'clock'
  | 'bell'
  | 'people'
  | 'user'
  | 'filter'
  | 'route'
  | 'prayer'
  | 'share'
  | 'bookmark'
  | 'star';

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
  'home',
  'pin',
  'book',
  'calendar',
  'clock',
  'bell',
  'people',
  'user',
  'filter',
  'route',
  'prayer',
  'share',
  'bookmark',
  'star',
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

const abs = { position: 'absolute' } as const;

function Ring({
  d,
  color,
  w,
  fill,
  style,
}: {
  d: number;
  color: string;
  w: number;
  fill?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        { width: d, height: d, borderRadius: d / 2 },
        fill ? { backgroundColor: color } : { borderWidth: w, borderColor: color },
        style,
      ]}
    />
  );
}

/** The line icons of the drawings. Physical on purpose, like the rest of this file. */
function objectArt(name: IconName, size: number, tint: string) {
  const w = Math.max(2, Math.round(size / 11));
  const line = (style: ViewStyle) => (
    <View style={[abs, { backgroundColor: tint, borderRadius: w }, style]} />
  );
  switch (name) {
    case 'home':
      return (
        <>
          <View
            style={[
              abs,
              {
                width: size * 0.5,
                height: size * 0.5,
                top: size * 0.12,
                borderTopWidth: w,
                borderLeftWidth: w,
                borderColor: tint,
                borderTopLeftRadius: w,
                transform: [{ rotate: '45deg' }],
              },
            ]}
          />
          <View
            style={[
              abs,
              {
                width: size * 0.62,
                height: size * 0.4,
                bottom: size * 0.1,
                borderWidth: w,
                borderTopWidth: 0,
                borderColor: tint,
                borderBottomLeftRadius: w,
                borderBottomRightRadius: w,
              },
            ]}
          />
        </>
      );
    case 'pin':
      return (
        <>
          <View
            style={[
              abs,
              {
                width: size * 0.62,
                height: size * 0.62,
                top: size * 0.08,
                borderWidth: w,
                borderColor: tint,
                borderRadius: size * 0.31,
                borderBottomRightRadius: 0,
                transform: [{ rotate: '45deg' }],
              },
            ]}
          />
          <Ring d={size * 0.2} color={tint} w={w} fill style={{ marginBottom: size * 0.1 }} />
        </>
      );
    case 'book':
      return (
        <>
          <View
            style={[
              abs,
              {
                width: size * 0.86,
                height: size * 0.62,
                borderWidth: w,
                borderColor: tint,
                borderRadius: w * 1.5,
              },
            ]}
          />
          {line({ width: w, height: size * 0.62 })}
        </>
      );
    case 'calendar':
      return (
        <>
          <View
            style={[
              abs,
              {
                width: size * 0.8,
                height: size * 0.72,
                bottom: size * 0.1,
                borderWidth: w,
                borderColor: tint,
                borderRadius: w * 1.5,
              },
            ]}
          />
          {line({ width: size * 0.8, height: w, top: size * 0.36 })}
          {line({ width: w, height: size * 0.2, top: size * 0.08, left: size * 0.3 })}
          {line({ width: w, height: size * 0.2, top: size * 0.08, right: size * 0.3 })}
        </>
      );
    case 'clock':
      return (
        <>
          <Ring d={size * 0.84} color={tint} w={w} />
          {line({ width: w, height: size * 0.26, top: size * 0.24 })}
          {line({ width: size * 0.22, height: w, left: size * 0.48 })}
        </>
      );
    case 'bell':
      return (
        <>
          <View
            style={[
              abs,
              {
                width: size * 0.6,
                height: size * 0.56,
                top: size * 0.12,
                borderWidth: w,
                borderBottomWidth: 0,
                borderColor: tint,
                borderTopLeftRadius: size * 0.3,
                borderTopRightRadius: size * 0.3,
              },
            ]}
          />
          {line({ width: size * 0.84, height: w, bottom: size * 0.24 })}
          <Ring d={size * 0.18} color={tint} w={w} fill style={[abs, { bottom: size * 0.04 }]} />
        </>
      );
    case 'people':
    case 'user': {
      const head = name === 'user' ? 0.36 : 0.3;
      return (
        <>
          <Ring d={size * head} color={tint} w={w} style={[abs, { top: size * 0.08 }]} />
          <View
            style={[
              abs,
              {
                width: size * 0.74,
                height: size * 0.34,
                bottom: size * 0.08,
                borderWidth: w,
                borderBottomWidth: 0,
                borderColor: tint,
                borderTopLeftRadius: size * 0.37,
                borderTopRightRadius: size * 0.37,
              },
            ]}
          />
          {name === 'people' ? (
            <Ring
              d={size * 0.22}
              color={tint}
              w={w}
              style={[abs, { top: size * 0.16, right: 0 }]}
            />
          ) : null}
        </>
      );
    }
    case 'filter':
      return (
        <>
          {[0.26, 0.5, 0.74].map((top, i) => (
            <View
              key={top}
              style={[
                abs,
                {
                  width: size * (i === 1 ? 0.5 : 0.78),
                  height: w,
                  top: size * top - w / 2,
                  backgroundColor: tint,
                  borderRadius: w,
                },
              ]}
            />
          ))}
        </>
      );
    case 'route':
      return (
        <>
          <Ring
            d={size * 0.26}
            color={tint}
            w={w}
            style={[abs, { bottom: size * 0.1, left: size * 0.1 }]}
          />
          <Ring
            d={size * 0.26}
            color={tint}
            w={w}
            style={[abs, { top: size * 0.1, right: size * 0.1 }]}
          />
          {line({ width: w, height: size * 0.5, transform: [{ rotate: '45deg' }] })}
        </>
      );
    case 'prayer':
      return (
        <>
          <View
            style={[
              abs,
              {
                width: size * 0.62,
                height: size * 0.6,
                bottom: size * 0.12,
                borderWidth: w,
                borderBottomWidth: 0,
                borderColor: tint,
                borderTopLeftRadius: size * 0.31,
                borderTopRightRadius: size * 0.31,
              },
            ]}
          />
          {line({ width: w, height: size * 0.18, top: size * 0.06 })}
          {line({ width: size * 0.88, height: w, bottom: size * 0.12 })}
        </>
      );
    case 'share':
      return (
        <>
          <View
            style={[
              abs,
              {
                width: size * 0.66,
                height: size * 0.44,
                bottom: size * 0.1,
                borderWidth: w,
                borderTopWidth: 0,
                borderColor: tint,
                borderBottomLeftRadius: w * 1.5,
                borderBottomRightRadius: w * 1.5,
              },
            ]}
          />
          {line({ width: w, height: size * 0.56, top: size * 0.1 })}
          <View
            style={[
              abs,
              {
                width: size * 0.28,
                height: size * 0.28,
                top: size * 0.12,
                borderTopWidth: w,
                borderLeftWidth: w,
                borderColor: tint,
                transform: [{ rotate: '45deg' }],
              },
            ]}
          />
        </>
      );
    case 'bookmark':
      return (
        <>
          <View
            style={[
              abs,
              {
                width: size * 0.56,
                height: size * 0.6,
                top: size * 0.1,
                borderWidth: w,
                borderBottomWidth: 0,
                borderColor: tint,
                borderTopLeftRadius: w,
                borderTopRightRadius: w,
              },
            ]}
          />
          {line({
            width: w,
            height: size * 0.36,
            bottom: size * 0.1,
            left: size * 0.36,
            transform: [{ rotate: '-50deg' }],
          })}
          {line({
            width: w,
            height: size * 0.36,
            bottom: size * 0.1,
            right: size * 0.36,
            transform: [{ rotate: '50deg' }],
          })}
        </>
      );
    case 'star':
      return (
        <>
          <View
            style={[
              abs,
              {
                width: size * 0.6,
                height: size * 0.6,
                borderWidth: w,
                borderColor: tint,
                borderRadius: w / 2,
              },
            ]}
          />
          <View
            style={[
              abs,
              {
                width: size * 0.6,
                height: size * 0.6,
                borderWidth: w,
                borderColor: tint,
                borderRadius: w / 2,
                transform: [{ rotate: '45deg' }],
              },
            ]}
          />
        </>
      );
    default:
      return undefined;
  }
}

export function Icon({ name, size = 24, color, accessibilityLabel }: IconProps) {
  const theme = useTheme();
  // In forced colours (web) the browser would repaint the drawn parts as the page colour, so
  // the art keeps its colours and is drawn in the system text colour instead (A-07).
  const forced = useForcedColors();
  const tint = forced ? systemColors.text : (color ?? theme.colors.text);
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
    default:
      art = objectArt(name, size, tint);
  }
  return (
    <View
      testID={`icon-${name}`}
      role={accessibilityLabel ? 'img' : undefined}
      aria-label={accessibilityLabel}
      aria-hidden={accessibilityLabel ? undefined : true}
      style={[s.box, { width: size, height: size }, flip, forced ? keepColorsInForcedMode : null]}
    >
      {art}
    </View>
  );
}
