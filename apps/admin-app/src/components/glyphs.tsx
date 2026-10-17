import { View } from 'react-native';
import { Icon } from '@qc/ui';

/**
 * Line icons the kit does not have yet (phone, chat, search and the four tab icons), drawn with
 * views so the app needs no icon font or SVG library. They are decoration: every button that uses
 * one carries its own name for a screen reader. None of them points anywhere, so none flips in
 * right-to-left.
 * TODO(kit): replace with the kit's icon set once it has these names.
 */
export type GlyphName =
  | 'call'
  | 'chat'
  | 'search'
  | 'today'
  | 'places'
  | 'bell'
  | 'user'
  | 'people'
  | 'clock'
  | 'tick'
  | 'minus';

export interface GlyphProps {
  name: GlyphName;
  /** A colour from the current theme. */
  color: string;
  /** Size in dp. Default 24. */
  size?: number;
}

function Ring({ d, color, stroke }: { d: number; color: string; stroke: number }) {
  return (
    <View
      style={{
        width: d,
        height: d,
        borderRadius: d / 2,
        borderWidth: stroke,
        borderColor: color,
      }}
    />
  );
}

function Bar({ w, h, color, style }: { w: number; h: number; color: string; style?: object }) {
  return (
    <View
      style={[{ width: w, height: h, borderRadius: h / 2, backgroundColor: color }, style as never]}
    />
  );
}

function Person({ size, color, stroke }: { size: number; color: string; stroke: number }) {
  const head = size * 0.38;
  return (
    <View style={{ alignItems: 'center', justifyContent: 'flex-end', height: size }}>
      <Ring d={head} color={color} stroke={stroke} />
      <View
        style={{
          width: size * 0.74,
          height: size * 0.34,
          marginTop: size * 0.06,
          borderTopStartRadius: size * 0.37,
          borderTopEndRadius: size * 0.37,
          borderWidth: stroke,
          borderBottomWidth: 0,
          borderColor: color,
        }}
      />
    </View>
  );
}

export function Glyph({ name, color, size = 24 }: GlyphProps) {
  const stroke = Math.max(2, Math.round(size / 12));
  let art;
  switch (name) {
    case 'call':
      // A phone held upright: a rounded body with a bar for the home button.
      art = (
        <View
          style={{
            width: size * 0.54,
            height: size * 0.88,
            borderRadius: size * 0.14,
            borderWidth: stroke,
            borderColor: color,
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingBottom: size * 0.07,
          }}
        >
          <Bar w={size * 0.2} h={stroke} color={color} />
        </View>
      );
      break;
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
    case 'search':
      art = (
        <View style={{ width: size * 0.9, height: size * 0.9 }}>
          <Ring d={size * 0.62} color={color} stroke={stroke} />
          <Bar
            w={size * 0.34}
            h={stroke}
            color={color}
            style={{
              position: 'absolute',
              end: 0,
              bottom: size * 0.1,
              transform: [{ rotate: '45deg' }],
            }}
          />
        </View>
      );
      break;
    case 'today':
      art = (
        <View
          style={{
            width: size * 0.86,
            height: size * 0.8,
            borderRadius: size * 0.16,
            borderWidth: stroke,
            borderColor: color,
          }}
        >
          <Bar
            w={size * 0.86 - stroke * 2}
            h={stroke}
            color={color}
            style={{ marginTop: size * 0.2 }}
          />
          <Bar
            w={stroke}
            h={size * 0.2}
            color={color}
            style={{ position: 'absolute', top: -size * 0.16, start: size * 0.18 }}
          />
          <Bar
            w={stroke}
            h={size * 0.2}
            color={color}
            style={{ position: 'absolute', top: -size * 0.16, end: size * 0.18 }}
          />
          <View
            style={{
              position: 'absolute',
              bottom: size * 0.12,
              alignSelf: 'center',
              width: size * 0.16,
              height: size * 0.16,
              borderRadius: size * 0.08,
              backgroundColor: color,
            }}
          />
        </View>
      );
      break;
    case 'places':
      // A masjid: a dome over a body with a doorway.
      art = (
        <View style={{ alignItems: 'center', justifyContent: 'flex-end', height: size }}>
          <View
            style={{
              width: size * 0.52,
              height: size * 0.28,
              borderTopStartRadius: size * 0.26,
              borderTopEndRadius: size * 0.26,
              borderWidth: stroke,
              borderBottomWidth: 0,
              borderColor: color,
            }}
          />
          <View
            style={{
              width: size * 0.84,
              height: size * 0.46,
              borderWidth: stroke,
              borderColor: color,
              borderRadius: size * 0.05,
              alignItems: 'center',
              justifyContent: 'flex-end',
            }}
          >
            <View
              style={{
                width: size * 0.22,
                height: size * 0.24,
                borderTopStartRadius: size * 0.11,
                borderTopEndRadius: size * 0.11,
                borderWidth: stroke,
                borderBottomWidth: 0,
                borderColor: color,
              }}
            />
          </View>
        </View>
      );
      break;
    case 'bell':
      art = (
        <View style={{ alignItems: 'center', height: size }}>
          <View
            style={{
              width: size * 0.6,
              height: size * 0.56,
              marginTop: size * 0.1,
              borderTopStartRadius: size * 0.3,
              borderTopEndRadius: size * 0.3,
              borderWidth: stroke,
              borderBottomWidth: 0,
              borderColor: color,
            }}
          />
          <Bar w={size * 0.82} h={stroke} color={color} />
          <View
            style={{
              width: size * 0.2,
              height: size * 0.12,
              marginTop: size * 0.04,
              borderBottomStartRadius: size * 0.1,
              borderBottomEndRadius: size * 0.1,
              backgroundColor: color,
            }}
          />
        </View>
      );
      break;
    case 'user':
      art = <Person size={size} color={color} stroke={stroke} />;
      break;
    case 'people':
      art = (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: size }}>
          <Person size={size * 0.76} color={color} stroke={stroke} />
          <View style={{ marginStart: -size * 0.12 }}>
            <Person size={size * 0.9} color={color} stroke={stroke} />
          </View>
        </View>
      );
      break;
    case 'clock':
      art = (
        <View
          style={{
            width: size * 0.9,
            height: size * 0.9,
            borderRadius: size * 0.45,
            borderWidth: stroke,
            borderColor: color,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Bar w={stroke} h={size * 0.26} color={color} style={{ marginBottom: size * 0.2 }} />
          <Bar
            w={size * 0.2}
            h={stroke}
            color={color}
            style={{
              position: 'absolute',
              start: size * 0.4 - stroke / 2,
              top: size * 0.45 - stroke,
            }}
          />
        </View>
      );
      break;
    case 'tick':
      art = (
        <View
          style={{
            width: size * 0.86,
            height: size * 0.86,
            borderRadius: size * 0.22,
            borderWidth: stroke,
            borderColor: color,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="check" size={size * 0.56} color={color} />
        </View>
      );
      break;
    case 'minus':
      art = <Bar w={size * 0.6} h={Math.max(2, Math.round(size / 10))} color={color} />;
      break;
  }
  return (
    <View
      aria-hidden
      testID={`glyph-${name}`}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      {art}
    </View>
  );
}
