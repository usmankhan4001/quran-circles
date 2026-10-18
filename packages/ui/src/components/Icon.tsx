import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { iconFlipTransform } from '../direction';
import { keepColorsInForcedMode, systemColors, useForcedColors } from '../forcedColors';
import { useTheme } from '../theme';
import { Text } from './Text';

/**
 * A small set of icons drawn with views, so the kit needs no icon font or SVG library.
 * Names that point somewhere (`chevron-forward`, `arrow-back`) mirror in right-to-left.
 * The object icons from `home` on are the drawings' line set (D12), so apps need no glyphs of
 * their own. The names from `arrow-forward` on follow the Iqraa style guide (D17): thin
 * Phosphor-like lines for the showcase's arrow, masjid, compass, seat pass, QR, phone, sun,
 * sliders, play and filled check.
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
  | 'star'
  | 'arrow-forward'
  | 'arrow-back'
  | 'minus'
  | 'masjid'
  | 'compass'
  | 'ticket'
  | 'qr'
  | 'phone'
  | 'sun'
  | 'sliders'
  | 'play'
  | 'check-circle';

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
  'arrow-forward',
  'arrow-back',
  'minus',
  'masjid',
  'compass',
  'ticket',
  'qr',
  'phone',
  'sun',
  'sliders',
  'play',
  'check-circle',
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
function objectArt(name: IconName, size: number, tint: string, knock: string) {
  const w = Math.max(2, Math.round(size / 11));
  const thin = Math.max(1.5, Math.round(size / 14));
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
                width: size * 0.54,
                height: size * 0.54,
                top: size * 0.12,
                borderTopWidth: w,
                borderLeftWidth: w,
                borderColor: tint,
                borderTopLeftRadius: w * 1.2,
                transform: [{ rotate: '45deg' }],
              },
            ]}
          />
          <View
            style={[
              abs,
              {
                width: size * 0.64,
                height: size * 0.42,
                bottom: size * 0.1,
                borderWidth: w,
                borderTopWidth: 0,
                borderColor: tint,
                borderBottomLeftRadius: w * 1.5,
                borderBottomRightRadius: w * 1.5,
              },
            ]}
          />
          <View
            style={[
              abs,
              {
                width: size * 0.22,
                height: size * 0.24,
                bottom: size * 0.1,
                borderWidth: thin,
                borderBottomWidth: 0,
                borderColor: tint,
                borderTopLeftRadius: size * 0.11,
                borderTopRightRadius: size * 0.11,
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
                borderBottomRightRadius: w * 0.5,
                transform: [{ rotate: '45deg' }],
              },
            ]}
          />
          <Ring d={size * 0.24} color={tint} w={thin} style={[abs, { top: size * 0.26 }]} />
          {line({ width: size * 0.36, height: thin, bottom: size * 0.06 })}
        </>
      );
    case 'book':
      return (
        <>
          <View
            style={[
              abs,
              {
                width: size * 0.84,
                height: size * 0.66,
                borderWidth: w,
                borderColor: tint,
                borderRadius: w * 1.8,
              },
            ]}
          />
          {line({ width: w, height: size * 0.66 })}
          {line({ width: size * 0.2, height: thin, top: size * 0.36, left: size * 0.18 })}
          {line({ width: size * 0.2, height: thin, top: size * 0.5, left: size * 0.18 })}
          {line({ width: size * 0.2, height: thin, top: size * 0.36, right: size * 0.18 })}
          {line({ width: size * 0.2, height: thin, top: size * 0.5, right: size * 0.18 })}
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
                bottom: size * 0.08,
                borderWidth: w,
                borderColor: tint,
                borderRadius: w * 1.8,
              },
            ]}
          />
          {line({ width: size * 0.8, height: w, top: size * 0.38 })}
          {line({ width: w, height: size * 0.2, top: size * 0.08, left: size * 0.3 })}
          {line({ width: w, height: size * 0.2, top: size * 0.08, right: size * 0.3 })}
          <Ring
            d={w * 1.3}
            color={tint}
            w={w}
            fill
            style={[abs, { bottom: size * 0.26, left: size * 0.3 }]}
          />
          <Ring
            d={w * 1.3}
            color={tint}
            w={w}
            fill
            style={[abs, { bottom: size * 0.26, right: size * 0.3 }]}
          />
        </>
      );
    case 'clock':
      return (
        <>
          <Ring d={size * 0.84} color={tint} w={w} />
          {line({ width: w, height: size * 0.26, top: size * 0.24 })}
          {line({ width: size * 0.22, height: w, left: size * 0.48 })}
          <Ring d={w * 1.5} color={tint} w={w} fill style={abs} />
        </>
      );
    case 'bell':
      return (
        <>
          {line({ width: w, height: size * 0.12, top: size * 0.3 })}
          <View
            style={[
              abs,
              {
                width: size * 0.6,
                height: size * 0.54,
                top: size * 0.14,
                borderWidth: w,
                borderBottomWidth: 0,
                borderColor: tint,
                borderTopLeftRadius: size * 0.3,
                borderTopRightRadius: size * 0.3,
              },
            ]}
          />
          {line({ width: size * 0.82, height: w, bottom: size * 0.24 })}
          <Ring d={size * 0.18} color={tint} w={w} fill style={[abs, { bottom: size * 0.05 }]} />
        </>
      );
    case 'people':
    case 'user': {
      const isPeople = name === 'people';
      const head = isPeople ? 0.3 : 0.36;
      return (
        <>
          <Ring
            d={size * head}
            color={tint}
            w={w}
            style={[abs, { top: size * 0.08, left: isPeople ? size * 0.2 : undefined }]}
          />
          <View
            style={[
              abs,
              {
                width: size * (isPeople ? 0.62 : 0.74),
                height: size * 0.34,
                bottom: size * 0.08,
                left: isPeople ? size * 0.06 : undefined,
                borderWidth: w,
                borderBottomWidth: 0,
                borderColor: tint,
                borderTopLeftRadius: size * 0.37,
                borderTopRightRadius: size * 0.37,
              },
            ]}
          />
          {isPeople ? (
            <>
              <Ring
                d={size * 0.24}
                color={tint}
                w={thin}
                style={[abs, { top: size * 0.14, right: size * 0.1 }]}
              />
              <View
                style={[
                  abs,
                  {
                    width: size * 0.34,
                    height: size * 0.26,
                    bottom: size * 0.08,
                    right: size * 0.04,
                    borderTopWidth: thin,
                    borderRightWidth: thin,
                    borderColor: tint,
                    borderTopRightRadius: size * 0.24,
                  },
                ]}
              />
            </>
          ) : null}
        </>
      );
    }
    case 'filter':
      return (
        <>
          {[0.26, 0.5, 0.74].map((top) => (
            <View
              key={top}
              style={[
                abs,
                {
                  width: size * 0.78,
                  height: w,
                  top: size * top - w / 2,
                  backgroundColor: tint,
                  borderRadius: w,
                },
              ]}
            />
          ))}
          <Ring
            d={size * 0.2}
            color={tint}
            w={thin}
            fill
            style={[abs, { top: size * 0.26 - size * 0.1, left: size * 0.22 }]}
          />
          <Ring
            d={size * 0.2}
            color={tint}
            w={thin}
            fill
            style={[abs, { top: size * 0.5 - size * 0.1, right: size * 0.22 }]}
          />
          <Ring
            d={size * 0.2}
            color={tint}
            w={thin}
            fill
            style={[abs, { top: size * 0.74 - size * 0.1, left: size * 0.34 }]}
          />
        </>
      );
    case 'route':
      return (
        <>
          <Ring
            d={size * 0.26}
            color={tint}
            w={w}
            style={[abs, { bottom: size * 0.08, left: size * 0.08 }]}
          />
          <Ring
            d={size * 0.26}
            color={tint}
            w={w}
            style={[abs, { top: size * 0.08, right: size * 0.08 }]}
          />
          <Ring d={w * 1.4} color={tint} w={w} fill />
          {line({ width: w, height: size * 0.48, transform: [{ rotate: '45deg' }] })}
        </>
      );
    case 'prayer':
      return (
        <>
          {line({ width: w, height: size * 0.16, top: size * 0.06 })}
          <View
            style={[
              abs,
              {
                width: size * 0.62,
                height: size * 0.58,
                bottom: size * 0.12,
                borderWidth: w,
                borderBottomWidth: 0,
                borderColor: tint,
                borderTopLeftRadius: size * 0.31,
                borderTopRightRadius: size * 0.31,
              },
            ]}
          />
          <View
            style={[
              abs,
              {
                width: size * 0.22,
                height: size * 0.26,
                bottom: size * 0.12,
                borderWidth: thin,
                borderBottomWidth: 0,
                borderColor: tint,
                borderTopLeftRadius: size * 0.11,
                borderTopRightRadius: size * 0.11,
              },
            ]}
          />
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
                width: size * 0.68,
                height: size * 0.44,
                bottom: size * 0.1,
                borderWidth: w,
                borderTopWidth: 0,
                borderColor: tint,
                borderBottomLeftRadius: w * 1.8,
                borderBottomRightRadius: w * 1.8,
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
                borderTopLeftRadius: w * 0.6,
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
                height: size * 0.62,
                top: size * 0.1,
                borderWidth: w,
                borderBottomWidth: 0,
                borderColor: tint,
                borderTopLeftRadius: w * 1.5,
                borderTopRightRadius: w * 1.5,
              },
            ]}
          />
          {line({ width: size * 0.32, height: thin, top: size * 0.26 })}
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
                borderRadius: w * 0.6,
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
                borderRadius: w * 0.6,
                transform: [{ rotate: '45deg' }],
              },
            ]}
          />
          <Ring d={w * 1.4} color={tint} w={w} fill />
        </>
      );
    case 'arrow-forward':
    case 'arrow-back': {
      // Drawn pointing forward; `arrow-back` is the same art turned round. Both mirror in RTL.
      const head = size * 0.34;
      return (
        <View
          style={[
            abs,
            {
              width: size,
              height: size,
              alignItems: 'center',
              justifyContent: 'center',
              transform: name === 'arrow-back' ? [{ scaleX: -1 }] : undefined,
            },
          ]}
        >
          {line({ width: size * 0.66, height: w, left: size * 0.15 })}
          <View
            style={[
              abs,
              {
                width: head,
                height: head,
                left: size * (0.85 - 0.24) - head / 2 - w / 2,
                borderTopWidth: w,
                borderRightWidth: w,
                borderColor: tint,
                borderTopRightRadius: w * 0.6,
                transform: [{ rotate: '45deg' }],
              },
            ]}
          />
        </View>
      );
    }
    case 'minus':
      return line({ width: size * 0.7, height: w });
    case 'masjid':
      return (
        <>
          {line({ width: size * 0.9, height: w, bottom: size * 0.1 })}
          {/* dome over the prayer hall, with its finial */}
          <View
            style={[
              abs,
              {
                width: size * 0.5,
                height: size * 0.5,
                bottom: size * 0.1,
                borderWidth: w,
                borderBottomWidth: 0,
                borderColor: tint,
                borderTopLeftRadius: size * 0.25,
                borderTopRightRadius: size * 0.25,
              },
            ]}
          />
          {line({ width: size * 0.5, height: thin, bottom: size * 0.34 })}
          {line({ width: w, height: size * 0.12, top: size * 0.3 })}
          <View
            style={[
              abs,
              {
                width: size * 0.14,
                height: size * 0.15,
                bottom: size * 0.1,
                borderWidth: thin,
                borderBottomWidth: 0,
                borderColor: tint,
                borderTopLeftRadius: size * 0.07,
                borderTopRightRadius: size * 0.07,
              },
            ]}
          />
          {/* two minarets, each a line with a round cap */}
          {line({ width: w, height: size * 0.5, bottom: size * 0.1, left: size * 0.1 })}
          {line({ width: w, height: size * 0.5, bottom: size * 0.1, right: size * 0.1 })}
          <Ring
            d={w * 1.8}
            color={tint}
            w={w}
            fill
            style={[abs, { top: size * 0.3 - w * 1.8, left: size * 0.1 + w / 2 - w * 0.9 }]}
          />
          <Ring
            d={w * 1.8}
            color={tint}
            w={w}
            fill
            style={[abs, { top: size * 0.3 - w * 1.8, right: size * 0.1 + w / 2 - w * 0.9 }]}
          />
        </>
      );
    case 'compass': {
      const half = size * 0.1;
      const tip = size * 0.24;
      const tri = (up: boolean): ViewStyle => ({
        width: 0,
        height: 0,
        borderLeftWidth: half,
        borderRightWidth: half,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        ...(up
          ? { borderBottomWidth: tip, borderBottomColor: tint }
          : { borderTopWidth: tip, borderTopColor: tint, opacity: 0.4 }),
      });
      return (
        <>
          <Ring d={size * 0.86} color={tint} w={w} />
          <View style={[abs, { alignItems: 'center', transform: [{ rotate: '45deg' }] }]}>
            <View style={tri(true)} />
            <View style={tri(false)} />
          </View>
        </>
      );
    }
    case 'ticket': {
      const r = size * 0.09;
      const half = (top: boolean): ViewStyle => ({
        position: 'absolute',
        width: size * 0.86,
        height: size * 0.3 - r + w / 2,
        ...(top
          ? {
              top: size * 0.2,
              borderTopWidth: w,
              borderTopLeftRadius: w * 1.8,
              borderTopRightRadius: w * 1.8,
            }
          : {
              bottom: size * 0.2,
              borderBottomWidth: w,
              borderBottomLeftRadius: w * 1.8,
              borderBottomRightRadius: w * 1.8,
            }),
        borderLeftWidth: w,
        borderRightWidth: w,
        borderColor: tint,
      });
      const notch = (start: boolean): ViewStyle => ({
        position: 'absolute',
        width: r + w / 2,
        height: r * 2,
        borderWidth: w,
        borderColor: tint,
        ...(start
          ? {
              left: size * 0.07,
              borderLeftWidth: 0,
              borderTopRightRadius: r,
              borderBottomRightRadius: r,
            }
          : {
              right: size * 0.07,
              borderRightWidth: 0,
              borderTopLeftRadius: r,
              borderBottomLeftRadius: r,
            }),
      });
      return (
        <>
          <View style={half(true)} />
          <View style={half(false)} />
          <View style={notch(true)} />
          <View style={notch(false)} />
          {[0.27, 0.45, 0.63].map((top) => (
            <View
              key={top}
              style={[
                abs,
                {
                  width: thin,
                  height: size * 0.1,
                  top: size * top,
                  left: size * 0.38,
                  backgroundColor: tint,
                  borderRadius: thin,
                },
              ]}
            />
          ))}
        </>
      );
    }
    case 'qr': {
      const box = size * 0.32;
      const finder = (pos: ViewStyle) => (
        <View
          style={[
            abs,
            pos,
            {
              width: box,
              height: box,
              borderWidth: w,
              borderColor: tint,
              borderRadius: w,
              alignItems: 'center',
              justifyContent: 'center',
            },
          ]}
        >
          <View style={{ width: box * 0.32, height: box * 0.32, backgroundColor: tint }} />
        </View>
      );
      const dot = (top: number, left: number) => (
        <View
          key={`${top}-${left}`}
          style={[
            abs,
            {
              top: size * top,
              left: size * left,
              width: size * 0.12,
              height: size * 0.12,
              backgroundColor: tint,
              borderRadius: thin / 2,
            },
          ]}
        />
      );
      return (
        <>
          {finder({ top: size * 0.08, left: size * 0.08 })}
          {finder({ top: size * 0.08, right: size * 0.08 })}
          {finder({ bottom: size * 0.08, left: size * 0.08 })}
          {dot(0.58, 0.58)}
          {dot(0.58, 0.8)}
          {dot(0.8, 0.58)}
          {dot(0.8, 0.8)}
          {dot(0.69, 0.69)}
        </>
      );
    }
    case 'phone':
      // A handset: the curved grip from earpiece (top start) to mouthpiece (bottom end).
      return (
        <>
          <View
            style={[
              abs,
              {
                width: size * 0.6,
                height: size * 0.6,
                top: size * 0.16,
                left: size * 0.16,
                borderLeftWidth: w,
                borderBottomWidth: w,
                borderColor: tint,
                borderBottomLeftRadius: size * 0.5,
              },
            ]}
          />
          {[
            { top: size * 0.1, left: size * 0.08 },
            { bottom: size * 0.08, right: size * 0.1 },
          ].map((pos, i) => (
            <View
              key={i}
              style={[
                abs,
                pos,
                {
                  width: size * 0.26,
                  height: size * 0.16,
                  backgroundColor: tint,
                  borderRadius: size * 0.06,
                  transform: [{ rotate: '-45deg' }],
                },
              ]}
            />
          ))}
        </>
      );
    case 'sun':
      return (
        <>
          <Ring d={size * 0.4} color={tint} w={w} />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
            <View
              key={a}
              style={[
                abs,
                {
                  width: w,
                  height: size * 0.12,
                  backgroundColor: tint,
                  borderRadius: w,
                  transform: [{ rotate: `${a}deg` }, { translateY: -size * 0.38 }],
                },
              ]}
            />
          ))}
        </>
      );
    case 'sliders': {
      // Two tracks, each broken by a round knob (Phosphor's sliders-horizontal).
      const knob = size * 0.22;
      const track = (top: number, at: number) => {
        const y = size * top - w / 2;
        const gap = knob / 2 + w * 0.2;
        return (
          <View key={top} style={[abs, { width: size, height: size, top: 0, left: 0 }]}>
            {line({ height: w, top: y, left: size * 0.08, width: size * at - gap - size * 0.08 })}
            {line({
              height: w,
              top: y,
              left: size * at + gap,
              width: size * 0.92 - size * at - gap,
            })}
            <Ring
              d={knob}
              color={tint}
              w={w}
              style={[abs, { top: size * top - knob / 2, left: size * at - knob / 2 }]}
            />
          </View>
        );
      };
      return (
        <>
          {track(0.3, 0.64)}
          {track(0.7, 0.36)}
        </>
      );
    }
    case 'play':
      return (
        <View
          style={{
            width: 0,
            height: 0,
            borderTopWidth: size * 0.34,
            borderBottomWidth: size * 0.34,
            borderLeftWidth: size * 0.58,
            borderTopColor: 'transparent',
            borderBottomColor: 'transparent',
            borderLeftColor: tint,
            transform: [{ translateX: size * 0.06 }],
          }}
        />
      );
    case 'check-circle':
      return (
        <View
          style={{
            width: size * 0.88,
            height: size * 0.88,
            borderRadius: size * 0.44,
            backgroundColor: tint,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Check size={size * 0.56} color={knock} />
        </View>
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
  // The colour cut out of filled shapes (the tick in `check-circle`).
  const knock = forced ? systemColors.background : theme.colors.surface;
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
      art = objectArt(name, size, tint, knock);
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
