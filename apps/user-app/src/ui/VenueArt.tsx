import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { useTheme, type SemanticColors } from '@qc/ui';

export interface VenueArtProps {
  /** Picks one of a few colourings, so places next to each other do not look the same. */
  seed: string;
  /** Height in dp. The scene is drawn to this height; the width follows the parent. */
  height: number;
  /** Things drawn on top of the art, such as a distance tag or buttons. */
  children?: ReactNode;
  testID?: string;
}

type ColorKey = keyof SemanticColors;

/**
 * The colourings, as theme colours, so the scene turns to night with the rest of the app.
 * `cover` is the mushaf's binding, `star` the eight-point pattern behind it.
 */
const PALETTES: readonly { sky: ColorKey; skyEnd: ColorKey; cover: ColorKey; star: ColorKey }[] = [
  { sky: 'accentSubtle', skyEnd: 'background', cover: 'accent', star: 'accent' },
  { sky: 'warningSubtle', skyEnd: 'background', cover: 'heroEnd', star: 'decoration' },
  { sky: 'successSubtle', skyEnd: 'surfaceMuted', cover: 'accentPressed', star: 'decoration' },
  { sky: 'surfaceMuted', skyEnd: 'accentSubtle', cover: 'hero', star: 'accent' },
];

/** A small stable number from a string, to pick a colouring. */
export function artIndex(seed: string, count: number = PALETTES.length): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return hash % count;
}

/**
 * The book and stand are drawn left to right in both languages, so each half keeps its lean.
 * `dir` is read by the web target and `direction` by native, as in the kit's ThemeProvider.
 */
const LTR = { dir: 'ltr' };

/** How far each half of the open mushaf leans, so the two pages make a shallow V. */
const TILT = 5;

const s = StyleSheet.create({
  box: { overflow: 'hidden', position: 'relative' },
  abs: { position: 'absolute' },
  center: { position: 'absolute', alignSelf: 'center' },
  fill: { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 },
});

/** An eight-point star (two squares, one turned a quarter), as an outline or filled. */
function Star({
  size,
  color,
  stroke,
  style,
}: {
  size: number;
  color: string;
  /** Line width for an outline; leave out for a filled star. */
  stroke?: number;
  style: ViewStyle;
}) {
  const square: ViewStyle = stroke
    ? { borderWidth: stroke, borderColor: color }
    : { backgroundColor: color };
  return (
    <View style={[s.abs, { width: size, height: size }, style]}>
      <View style={[s.fill, square]} />
      <View style={[s.fill, square, { transform: [{ rotate: '45deg' }] }]} />
    </View>
  );
}

/**
 * Drawn venue art (S1, H4): an open mushaf on a rehal (the folding Quran stand), with a soft
 * light and an eight-point star pattern behind it. The contract has no photo of a place yet, so
 * this stands in for one everywhere a photo is drawn. It is decoration: the place's name is
 * always written next to it. The pages carry plain lines, never letters (D4: no stand-in Quran
 * text). The drawing is symmetrical; the book and stand are laid out left to right in both
 * languages so each half keeps its lean, and the picture looks the same in Urdu.
 * TODO(contracts): show the venue photo when the contract gains a photo field.
 */
export function VenueArt({ seed, height: h, children, testID }: VenueArtProps) {
  const theme = useTheme();
  const c = theme.colors;
  const palette = PALETTES[artIndex(seed)] ?? PALETTES[0]!;
  const sky = c[palette.sky];
  const skyEnd = c[palette.skyEnd];
  const cover = c[palette.cover];
  const star = c[palette.star];
  const page = c.textOnHero;
  const gilt = c.decoration;
  const sky3d: ViewStyle =
    Platform.OS === 'web'
      ? ({ backgroundImage: `linear-gradient(180deg, ${sky} 0%, ${skyEnd} 100%)` } as ViewStyle)
      : {};

  const hair = Math.max(1, h * 0.008);
  // The medallion behind the book: a glow, a ring and a large star, sharing one centre.
  const mid = h * 0.47;
  const glow = h * 0.74;
  const starSize = h * 0.6;
  const ring = starSize * 1.2;
  const dot = h * 0.07;

  // The book and stand, measured from the bottom of their group.
  const groupW = h * 0.76;
  const groupH = h * 0.66;
  const half = groupW / 2;
  const pad = Math.max(2, h * 0.02);
  const pageW = h * 0.3;
  const pageH = h * 0.38;
  const leafW = pageW + pad * 2;
  const board = h * 0.035;
  const bookBottom = h * 0.19;
  const inward = h * 0.02;
  const cross = h * 0.1;
  const legLength = h * 0.38;
  const legW = Math.max(3, h * 0.04);
  const knob = h * 0.06;
  const lines = h >= 150 ? 9 : 6;

  const leaf = (key: string, start: number, rotate: string) => (
    <View
      key={key}
      style={[s.abs, { start, bottom: bookBottom, width: leafW, transform: [{ rotate }] }]}
    >
      <View style={{ padding: pad, borderRadius: pad, backgroundColor: cover }}>
        <View
          style={{
            height: pageH,
            padding: pageW * 0.08,
            borderRadius: 1,
            backgroundColor: page,
          }}
        >
          <View
            style={{
              flex: 1,
              borderWidth: hair,
              borderColor: gilt,
              borderRadius: 1,
              paddingHorizontal: pageW * 0.08,
              paddingVertical: pageH * 0.05,
              justifyContent: 'space-evenly',
            }}
          >
            <View
              style={{
                height: Math.max(2, h * 0.03),
                borderRadius: h,
                backgroundColor: gilt,
                opacity: 0.7,
              }}
            />
            {Array.from({ length: lines }, (_, i) => (
              <View
                key={i}
                style={{ height: hair, borderRadius: hair, backgroundColor: c.hero, opacity: 0.35 }}
              />
            ))}
          </View>
        </View>
      </View>
      <View
        style={{
          height: board,
          marginHorizontal: -pad / 2,
          borderRadius: board / 2,
          backgroundColor: gilt,
        }}
      />
    </View>
  );

  const leg = (key: string, rotate: string) => (
    <View
      key={key}
      style={[
        s.abs,
        {
          start: half - legW / 2,
          bottom: cross - legLength / 2,
          width: legW,
          height: legLength,
          borderRadius: legW / 2,
          backgroundColor: gilt,
          transform: [{ rotate }],
        },
      ]}
    />
  );

  const foot = (key: string, start: number) => (
    <View
      key={key}
      style={[
        s.abs,
        {
          start,
          bottom: 0,
          width: h * 0.08,
          height: Math.max(2, h * 0.02),
          borderRadius: h,
          backgroundColor: gilt,
        },
      ]}
    />
  );

  return (
    <View testID={testID} aria-hidden style={[s.box, { height: h, backgroundColor: sky }, sky3d]}>
      <View
        style={[
          s.center,
          {
            top: mid - glow / 2,
            width: glow,
            height: glow,
            borderRadius: glow,
            backgroundColor: page,
            opacity: 0.45,
          },
        ]}
      />
      <View
        style={[
          s.center,
          {
            top: mid - ring / 2,
            width: ring,
            height: ring,
            borderRadius: ring,
            borderWidth: hair,
            borderColor: star,
            opacity: 0.3,
          },
        ]}
      />
      <Star
        size={starSize}
        color={star}
        stroke={Math.max(1, h * 0.012)}
        style={{ top: mid - starSize / 2, alignSelf: 'center', opacity: 0.45 }}
      />
      <Star size={dot} color={star} style={{ top: '16%', start: '8%', opacity: 0.3 }} />
      <Star size={dot} color={star} style={{ top: '16%', end: '8%', opacity: 0.3 }} />
      <Star size={dot * 0.7} color={star} style={{ top: '56%', start: '17%', opacity: 0.25 }} />
      <Star size={dot * 0.7} color={star} style={{ top: '56%', end: '17%', opacity: 0.25 }} />
      <View
        style={[
          s.abs,
          {
            bottom: -h * 0.22,
            start: '-30%',
            width: '160%',
            height: h * 0.36,
            borderRadius: h * 2,
            backgroundColor: c.hero,
            opacity: 0.18,
          },
        ]}
      />
      <View
        style={[
          s.center,
          {
            bottom: h * 0.05,
            width: h * 0.46,
            height: h * 0.05,
            borderRadius: h,
            backgroundColor: c.hero,
            opacity: 0.3,
          },
        ]}
      />
      <View
        testID={testID ? `${testID}-mushaf` : undefined}
        {...LTR}
        style={[s.center, { bottom: h * 0.07, width: groupW, height: groupH, direction: 'ltr' }]}
      >
        {leg('leg-a', '56deg')}
        {leg('leg-b', '-56deg')}
        {foot('foot-a', half - h * 0.15 - h * 0.04)}
        {foot('foot-b', half + h * 0.15 - h * 0.04)}
        <View
          style={[
            s.abs,
            {
              start: half - knob / 2,
              bottom: cross - knob / 2,
              width: knob,
              height: knob,
              borderRadius: knob,
              backgroundColor: c.accentPressed,
            },
          ]}
        />
        {leaf('leaf-a', half - leafW + inward, `${TILT}deg`)}
        {leaf('leaf-b', half - inward, `-${TILT}deg`)}
        <View
          style={[
            s.abs,
            {
              start: half - Math.max(2, h * 0.025) / 2,
              bottom: bookBottom + board,
              width: Math.max(2, h * 0.025),
              height: pageH + pad,
              borderRadius: h,
              backgroundColor: cover,
            },
          ]}
        />
      </View>
      {children}
    </View>
  );
}
