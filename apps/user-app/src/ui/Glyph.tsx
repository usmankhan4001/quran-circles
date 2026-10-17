import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useTheme } from '@qc/ui';

/**
 * The few pictures the redesign needs that the kit's icon set does not have yet, drawn with
 * views like the kit's own icons. They are decoration: the words next to them carry the meaning.
 * TODO(kit): replace with @qc/ui icons when the ui lane adds home, pin, book, calendar, search,
 * clock, bell, people, route and prayer.
 */
export type GlyphName =
  | 'home'
  | 'pin'
  | 'book'
  | 'calendar'
  | 'search'
  | 'clock'
  | 'bell'
  | 'people'
  | 'route'
  | 'prayer'
  | 'filter'
  | 'user';

export interface GlyphProps {
  name: GlyphName;
  size?: number;
  color?: string;
}

const center = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
  abs: { position: 'absolute' },
});

function stroke(size: number): number {
  return Math.max(2, Math.round(size / 11));
}

function Circle({
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
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        {
          width: d,
          height: d,
          borderRadius: d / 2,
          ...(fill ? { backgroundColor: color } : { borderWidth: w, borderColor: color }),
        },
        style,
      ]}
    />
  );
}

export function Glyph({ name, size = 24, color }: GlyphProps) {
  const theme = useTheme();
  const tint = color ?? theme.colors.text;
  const w = stroke(size);
  let art;
  switch (name) {
    case 'home':
      art = (
        <>
          <View
            style={[
              center.abs,
              {
                width: size * 0.5,
                height: size * 0.5,
                top: size * 0.12,
                borderTopWidth: w,
                borderLeftWidth: w,
                borderColor: tint,
                borderTopStartRadius: w,
                transform: [{ rotate: '45deg' }],
              },
            ]}
          />
          <View
            style={[
              center.abs,
              {
                width: size * 0.62,
                height: size * 0.4,
                bottom: size * 0.1,
                borderWidth: w,
                borderTopWidth: 0,
                borderColor: tint,
                borderBottomStartRadius: w,
                borderBottomEndRadius: w,
              },
            ]}
          />
        </>
      );
      break;
    case 'pin':
      art = (
        <>
          <View
            style={[
              center.abs,
              {
                width: size * 0.62,
                height: size * 0.62,
                top: size * 0.08,
                borderWidth: w,
                borderColor: tint,
                borderRadius: size * 0.31,
                borderBottomEndRadius: 0,
                transform: [{ rotate: '45deg' }],
              },
            ]}
          />
          <Circle d={size * 0.2} color={tint} w={w} fill style={{ marginBottom: size * 0.1 }} />
        </>
      );
      break;
    case 'book':
      art = (
        <>
          <View
            style={[
              center.abs,
              {
                width: size * 0.86,
                height: size * 0.62,
                borderWidth: w,
                borderColor: tint,
                borderRadius: w * 1.5,
              },
            ]}
          />
          <View style={[center.abs, { width: w, height: size * 0.62, backgroundColor: tint }]} />
        </>
      );
      break;
    case 'calendar':
      art = (
        <>
          <View
            style={[
              center.abs,
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
          <View
            style={[
              center.abs,
              { width: size * 0.8, height: w, top: size * 0.36, backgroundColor: tint },
            ]}
          />
          <View
            style={[
              center.abs,
              {
                width: w,
                height: size * 0.2,
                top: size * 0.08,
                left: size * 0.3,
                backgroundColor: tint,
              },
            ]}
          />
          <View
            style={[
              center.abs,
              {
                width: w,
                height: size * 0.2,
                top: size * 0.08,
                right: size * 0.3,
                backgroundColor: tint,
              },
            ]}
          />
        </>
      );
      break;
    case 'search':
      art = (
        <>
          <Circle
            d={size * 0.6}
            color={tint}
            w={w}
            style={{ position: 'absolute', top: size * 0.1, left: size * 0.1 }}
          />
          <View
            style={[
              center.abs,
              {
                width: w,
                height: size * 0.3,
                bottom: size * 0.06,
                right: size * 0.16,
                backgroundColor: tint,
                borderRadius: w,
                transform: [{ rotate: '-45deg' }],
              },
            ]}
          />
        </>
      );
      break;
    case 'clock':
      art = (
        <>
          <Circle d={size * 0.84} color={tint} w={w} />
          <View
            style={[
              center.abs,
              { width: w, height: size * 0.26, top: size * 0.24, backgroundColor: tint },
            ]}
          />
          <View
            style={[
              center.abs,
              { width: size * 0.22, height: w, left: size * 0.48, backgroundColor: tint },
            ]}
          />
        </>
      );
      break;
    case 'bell':
      art = (
        <>
          <View
            style={[
              center.abs,
              {
                width: size * 0.6,
                height: size * 0.56,
                top: size * 0.12,
                borderWidth: w,
                borderBottomWidth: 0,
                borderColor: tint,
                borderTopStartRadius: size * 0.3,
                borderTopEndRadius: size * 0.3,
              },
            ]}
          />
          <View
            style={[
              center.abs,
              {
                width: size * 0.84,
                height: w,
                bottom: size * 0.24,
                backgroundColor: tint,
                borderRadius: w,
              },
            ]}
          />
          <Circle
            d={size * 0.18}
            color={tint}
            w={w}
            fill
            style={{ position: 'absolute', bottom: size * 0.04 }}
          />
        </>
      );
      break;
    case 'people':
      art = (
        <>
          <Circle
            d={size * 0.34}
            color={tint}
            w={w}
            style={{ position: 'absolute', top: size * 0.1 }}
          />
          <View
            style={[
              center.abs,
              {
                width: size * 0.7,
                height: size * 0.36,
                bottom: size * 0.1,
                borderWidth: w,
                borderBottomWidth: 0,
                borderColor: tint,
                borderTopStartRadius: size * 0.35,
                borderTopEndRadius: size * 0.35,
              },
            ]}
          />
        </>
      );
      break;
    case 'user':
      art = (
        <>
          <Circle
            d={size * 0.36}
            color={tint}
            w={w}
            style={{ position: 'absolute', top: size * 0.08 }}
          />
          <View
            style={[
              center.abs,
              {
                width: size * 0.76,
                height: size * 0.34,
                bottom: size * 0.08,
                borderWidth: w,
                borderBottomWidth: 0,
                borderColor: tint,
                borderTopStartRadius: size * 0.38,
                borderTopEndRadius: size * 0.38,
              },
            ]}
          />
        </>
      );
      break;
    case 'filter':
      art = (
        <>
          {[0.26, 0.5, 0.74].map((top, i) => (
            <View
              key={top}
              style={[
                center.abs,
                {
                  width: size * (i === 1 ? 0.5 : 0.78),
                  height: w,
                  top: size * top,
                  backgroundColor: tint,
                  borderRadius: w,
                },
              ]}
            />
          ))}
        </>
      );
      break;
    case 'route':
      art = (
        <>
          <Circle
            d={size * 0.26}
            color={tint}
            w={w}
            style={{ position: 'absolute', bottom: size * 0.1, left: size * 0.1 }}
          />
          <Circle
            d={size * 0.26}
            color={tint}
            w={w}
            style={{ position: 'absolute', top: size * 0.1, right: size * 0.1 }}
          />
          <View
            style={[
              center.abs,
              {
                width: w,
                height: size * 0.5,
                backgroundColor: tint,
                transform: [{ rotate: '45deg' }],
              },
            ]}
          />
        </>
      );
      break;
    case 'prayer':
      art = (
        <>
          <View
            style={[
              center.abs,
              {
                width: size * 0.7,
                height: size * 0.7,
                bottom: size * 0.12,
                borderWidth: w,
                borderBottomWidth: 0,
                borderColor: tint,
                borderTopStartRadius: size * 0.35,
                borderTopEndRadius: size * 0.35,
              },
            ]}
          />
          <View
            style={[
              center.abs,
              { width: w, height: size * 0.2, top: size * 0.06, backgroundColor: tint },
            ]}
          />
          <View
            style={[
              center.abs,
              { width: size * 0.84, height: w, bottom: size * 0.12, backgroundColor: tint },
            ]}
          />
        </>
      );
      break;
  }
  return (
    <View testID={`glyph-${name}`} aria-hidden style={[center.box, { width: size, height: size }]}>
      {art}
    </View>
  );
}
