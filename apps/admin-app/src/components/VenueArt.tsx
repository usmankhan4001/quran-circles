import { View } from 'react-native';
import { useTheme } from '@qc/ui';

export interface VenueArtProps {
  /** Picks one of the drawn variants, so neighbouring cards do not look the same. */
  seed: string;
  /** Height in dp. Default 104. */
  height?: number;
  testID?: string;
}

/** A small, stable number from an id. */
function variantOf(seed: string, count: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) % 9973;
  return h % count;
}

/**
 * Drawn venue art in place of a photo: a masjid with a dome and two minarets against the green
 * evening sky, from theme colours only. The contract has no venue photo yet; when it gets one,
 * the photo replaces this. Decoration only, hidden from screen readers. The drawing is
 * symmetrical, so it reads the same left to right and right to left.
 */
export function VenueArt({ seed, height = 104, testID }: VenueArtProps) {
  const { colors } = useTheme();
  const v = variantOf(seed, 3);
  const dome = v === 1 ? colors.accentSubtle : colors.decoration;
  const body = colors.surface;
  const unit = height / 104;
  const minaret = (key: string) => (
    <View key={key} style={{ alignItems: 'center' }}>
      <View
        style={{
          width: 8 * unit,
          height: 8 * unit,
          backgroundColor: dome,
          transform: [{ rotate: '45deg' }],
          marginBottom: -4 * unit,
        }}
      />
      <View
        style={{
          width: 9 * unit,
          height: (v === 2 ? 52 : 46) * unit,
          backgroundColor: body,
          borderTopStartRadius: 2,
          borderTopEndRadius: 2,
        }}
      />
    </View>
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
      {/* The moon. */}
      <View
        style={{
          position: 'absolute',
          top: 14 * unit,
          end: 22 * unit,
          width: 14 * unit,
          height: 14 * unit,
          borderRadius: 7 * unit,
          backgroundColor: colors.heroGlass,
        }}
      />
      {/* The masjid, standing on the ground. */}
      <View
        style={{
          position: 'absolute',
          start: 0,
          end: 0,
          bottom: 12 * unit,
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'center',
          gap: 6 * unit,
        }}
      >
        {minaret('a')}
        <View style={{ alignItems: 'center' }}>
          <View
            style={{
              width: 46 * unit,
              height: 24 * unit,
              borderTopStartRadius: 23 * unit,
              borderTopEndRadius: 23 * unit,
              backgroundColor: dome,
            }}
          />
          <View
            style={{
              width: 58 * unit,
              height: 28 * unit,
              backgroundColor: body,
              alignItems: 'center',
              justifyContent: 'flex-end',
            }}
          >
            <View
              style={{
                width: 12 * unit,
                height: 16 * unit,
                borderTopStartRadius: 6 * unit,
                borderTopEndRadius: 6 * unit,
                backgroundColor: colors.hero,
              }}
            />
          </View>
        </View>
        {minaret('b')}
      </View>
      {/* The ground. */}
      <View
        style={{
          position: 'absolute',
          start: 0,
          end: 0,
          bottom: 0,
          height: 12 * unit,
          backgroundColor: colors.accent,
        }}
      />
    </View>
  );
}
