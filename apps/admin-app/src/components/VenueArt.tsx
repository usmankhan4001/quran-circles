import { View, type ViewStyle } from 'react-native';
import { useTheme, type SemanticColors } from '@qc/ui';

export interface VenueArtProps {
  /** Picks one of the drawn variants, so neighbouring cards do not look the same. */
  seed: string;
  /** Height in dp. Default 104. */
  height?: number;
  testID?: string;
}

/** A small, stable number from an id. */
export function variantOf(seed: string, count: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) % 9973;
  return h % count;
}

type ColorKey = keyof SemanticColors;

/** The mushaf's binding and the stand's wood, per variant, as theme colours. */
const VARIANTS: readonly { cover: ColorKey; stand: ColorKey }[] = [
  { cover: 'decoration', stand: 'accentSubtle' },
  { cover: 'accentSubtle', stand: 'decoration' },
  { cover: 'warningSubtle', stand: 'decoration' },
];

/**
 * The book and stand are drawn left to right in both languages, so each half keeps its lean.
 * `dir` is read by the web target and `direction` by native, as in the kit's ThemeProvider.
 */
const LTR = { dir: 'ltr' };

/** How far each half of the open mushaf leans, so the two pages make a shallow V. */
const TILT = 5;

const fill: ViewStyle = { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 };

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
    <View style={[{ position: 'absolute', width: size, height: size }, style]}>
      <View style={[fill, square]} />
      <View style={[fill, square, { transform: [{ rotate: '45deg' }] }]} />
    </View>
  );
}

/**
 * Drawn venue art in place of a photo: an open mushaf on a rehal (the folding Quran stand) in
 * front of a soft light and an eight-point star, on the green evening sky, from theme colours
 * only. The pages carry plain lines, never letters (no stand-in Quran text). The contract has no
 * venue photo yet; when it gets one, the photo replaces this. Decoration only, hidden from screen
 * readers. The drawing is symmetrical, and the book is laid out left to right in both languages
 * so each half keeps its lean; it reads the same left to right and right to left.
 */
export function VenueArt({ seed, height = 104, testID }: VenueArtProps) {
  const { colors } = useTheme();
  const variant = VARIANTS[variantOf(seed, VARIANTS.length)] ?? VARIANTS[0]!;
  const cover = colors[variant.cover];
  const stand = colors[variant.stand];
  const page = colors.textOnHero;
  const gilt = colors.decoration;
  const h = height;
  const hair = Math.max(1, h * 0.008);
  const ground = h * 0.115;

  // The medallion behind the book: a glow and a large star outline, sharing one centre.
  const mid = h * 0.46;
  const glow = h * 0.74;
  const starSize = h * 0.6;

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

  const leaf = (key: string, start: number, rotate: string) => (
    <View
      key={key}
      style={{
        position: 'absolute',
        start,
        bottom: bookBottom,
        width: leafW,
        transform: [{ rotate }],
      }}
    >
      <View style={{ padding: pad, borderRadius: pad, backgroundColor: cover }}>
        <View
          style={{ height: pageH, padding: pageW * 0.08, borderRadius: 1, backgroundColor: page }}
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
            {Array.from({ length: 6 }, (_, i) => (
              <View
                key={i}
                style={{
                  height: hair,
                  borderRadius: hair,
                  backgroundColor: colors.hero,
                  opacity: 0.35,
                }}
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
          backgroundColor: stand,
        }}
      />
    </View>
  );

  const leg = (key: string, rotate: string) => (
    <View
      key={key}
      style={{
        position: 'absolute',
        start: half - legW / 2,
        bottom: cross - legLength / 2,
        width: legW,
        height: legLength,
        borderRadius: legW / 2,
        backgroundColor: stand,
        transform: [{ rotate }],
      }}
    />
  );

  return (
    <View
      testID={testID}
      aria-hidden
      style={{ height, overflow: 'hidden', backgroundColor: colors.hero }}
    >
      {/* The sky lightens towards the ground. */}
      <View
        style={{
          position: 'absolute',
          start: 0,
          end: 0,
          bottom: 0,
          height: height * 0.55,
          backgroundColor: colors.heroEnd,
          opacity: 0.6,
        }}
      />
      {/* A soft light behind the book, a large star outline and two small stars. */}
      <View
        style={{
          position: 'absolute',
          alignSelf: 'center',
          top: mid - glow / 2,
          width: glow,
          height: glow,
          borderRadius: glow,
          backgroundColor: colors.heroGlass,
        }}
      />
      <Star
        size={starSize}
        color={page}
        stroke={Math.max(1, h * 0.012)}
        style={{ top: mid - starSize / 2, alignSelf: 'center', opacity: 0.3 }}
      />
      <Star size={h * 0.07} color={colors.heroGlassPressed} style={{ top: '14%', start: '9%' }} />
      <Star size={h * 0.07} color={colors.heroGlassPressed} style={{ top: '14%', end: '9%' }} />
      {/* The mushaf on its stand, standing on the ground. */}
      <View
        testID={testID ? `${testID}-mushaf` : undefined}
        {...LTR}
        style={{
          position: 'absolute',
          alignSelf: 'center',
          bottom: ground * 0.6,
          width: groupW,
          height: groupH,
          direction: 'ltr',
        }}
      >
        {leg('leg-a', '56deg')}
        {leg('leg-b', '-56deg')}
        <View
          style={{
            position: 'absolute',
            start: half - knob / 2,
            bottom: cross - knob / 2,
            width: knob,
            height: knob,
            borderRadius: knob,
            backgroundColor: gilt,
          }}
        />
        {leaf('leaf-a', half - leafW + inward, `${TILT}deg`)}
        {leaf('leaf-b', half - inward, `-${TILT}deg`)}
        <View
          style={{
            position: 'absolute',
            start: half - Math.max(2, h * 0.025) / 2,
            bottom: bookBottom + board,
            width: Math.max(2, h * 0.025),
            height: pageH + pad,
            borderRadius: h,
            backgroundColor: cover,
          }}
        />
      </View>
      {/* The ground. */}
      <View
        style={{
          position: 'absolute',
          start: 0,
          end: 0,
          bottom: 0,
          height: ground,
          backgroundColor: colors.accent,
        }}
      />
    </View>
  );
}
