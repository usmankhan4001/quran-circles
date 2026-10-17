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

/** The colourings, as theme colours, so the scene turns to night with the rest of the app. */
const PALETTES: readonly { sky: ColorKey; skyEnd: ColorKey; dome: ColorKey }[] = [
  { sky: 'accentSubtle', skyEnd: 'background', dome: 'accent' },
  { sky: 'warningSubtle', skyEnd: 'background', dome: 'heroEnd' },
  { sky: 'successSubtle', skyEnd: 'surfaceMuted', dome: 'decoration' },
  { sky: 'surfaceMuted', skyEnd: 'accentSubtle', dome: 'hero' },
];

/** A small stable number from a string, to pick a colouring. */
export function artIndex(seed: string, count: number = PALETTES.length): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return hash % count;
}

const s = StyleSheet.create({
  box: { overflow: 'hidden', position: 'relative' },
  abs: { position: 'absolute' },
  center: { position: 'absolute', alignSelf: 'center' },
});

/**
 * Drawn venue art (S1, H4): a masjid with its dome and two minarets on a hill under the sky.
 * The contract has no photo of a place yet, so this stands in for one everywhere a photo is
 * drawn. It is decoration: the place's name is always written next to it.
 * TODO(contracts): show the venue photo when the contract gains a photo field.
 */
export function VenueArt({ seed, height: h, children, testID }: VenueArtProps) {
  const theme = useTheme();
  const c = theme.colors;
  const palette = PALETTES[artIndex(seed)] ?? PALETTES[0]!;
  const sky = c[palette.sky];
  const skyEnd = c[palette.skyEnd];
  const dome = c[palette.dome];
  const wall = c.textOnHero;
  const sky3d: ViewStyle =
    Platform.OS === 'web'
      ? ({ backgroundImage: `linear-gradient(180deg, ${sky} 0%, ${skyEnd} 100%)` } as ViewStyle)
      : {};
  const group = h * 0.62;
  const minaretW = Math.max(4, h * 0.06);
  const minaretH = h * 0.42;
  const hallW = h * 0.4;
  const hallH = h * 0.26;
  const domeW = h * 0.36;
  const domeH = h * 0.2;
  const cap = (side: 'start' | 'end'): ViewStyle => ({
    position: 'absolute',
    bottom: minaretH,
    [side]: 0,
    width: 0,
    height: 0,
    borderLeftWidth: minaretW / 2,
    borderRightWidth: minaretW / 2,
    borderBottomWidth: h * 0.07,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: dome,
  });
  return (
    <View testID={testID} aria-hidden style={[s.box, { height: h, backgroundColor: sky }, sky3d]}>
      <View
        style={[
          s.abs,
          {
            top: h * 0.1,
            end: '16%',
            width: h * 0.16,
            height: h * 0.16,
            borderRadius: h,
            backgroundColor: wall,
            opacity: 0.55,
          },
        ]}
      />
      <View
        style={[
          s.abs,
          {
            bottom: -h * 0.26,
            start: '-30%',
            width: '160%',
            height: h * 0.52,
            borderRadius: h * 2,
            backgroundColor: c.heroEnd,
          },
        ]}
      />
      <View style={[s.center, { bottom: h * 0.14, width: group, height: group }]}>
        <View
          style={[
            s.abs,
            { bottom: 0, start: 0, width: minaretW, height: minaretH, backgroundColor: wall },
          ]}
        />
        <View style={cap('start')} />
        <View
          style={[
            s.abs,
            { bottom: 0, end: 0, width: minaretW, height: minaretH, backgroundColor: wall },
          ]}
        />
        <View style={cap('end')} />
        <View
          style={[
            s.center,
            {
              bottom: hallH - 1,
              width: domeW,
              height: domeH,
              borderTopLeftRadius: domeW / 2,
              borderTopRightRadius: domeW / 2,
              backgroundColor: dome,
            },
          ]}
        />
        <View
          style={[
            s.center,
            {
              bottom: hallH + domeH - 1,
              width: Math.max(2, h * 0.015),
              height: h * 0.06,
              backgroundColor: c.decoration,
            },
          ]}
        />
        <View
          style={[
            s.center,
            {
              bottom: 0,
              width: hallW,
              height: hallH,
              borderTopLeftRadius: 2,
              borderTopRightRadius: 2,
              backgroundColor: wall,
            },
          ]}
        />
        <View
          style={[
            s.center,
            {
              bottom: 0,
              width: h * 0.08,
              height: h * 0.12,
              borderTopLeftRadius: h * 0.04,
              borderTopRightRadius: h * 0.04,
              backgroundColor: c.accentPressed,
            },
          ]}
        />
      </View>
      <View
        style={[
          s.abs,
          {
            bottom: -h * 0.16,
            start: '-20%',
            width: '140%',
            height: h * 0.32,
            borderRadius: h * 2,
            backgroundColor: c.hero,
          },
        ]}
      />
      <View
        style={[
          s.abs,
          {
            bottom: h * 0.08,
            start: '8%',
            width: h * 0.14,
            height: h * 0.14,
            borderRadius: h,
            backgroundColor: c.accent,
          },
        ]}
      />
      <View
        style={[
          s.abs,
          {
            bottom: h * 0.06,
            end: '6%',
            width: h * 0.17,
            height: h * 0.17,
            borderRadius: h,
            backgroundColor: c.accentPressed,
          },
        ]}
      />
      {children}
    </View>
  );
}
