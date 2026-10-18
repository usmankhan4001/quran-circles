import { Pressable, StyleSheet, View } from 'react-native';
import { Text, elevation, useTheme } from '@qc/ui';
import { useTextWeight } from './textWeight';

export interface HomePrayer {
  key: string;
  name: string;
  /** Already formatted, such as "6:28", or "--:--" before a city is chosen. */
  time: string;
}

export interface HomePrayerTimesProps {
  prayers: readonly HomePrayer[];
  /** The prayer whose time it is now: drawn on a white pill. None before a city is chosen. */
  activeKey?: string | null;
  /** Said before the highlighted prayer, such as "Now". */
  activeLabel: string;
  /** Opens Quran & Prayer (where the city is chosen). */
  onPress?: () => void;
  /** The name of the whole strip when it is a button. */
  accessibilityLabel: string;
  testID?: string;
}

const styles = StyleSheet.create({
  // As drawn: a grey tray, corners 16, 10 × 12 inside, five equal columns.
  tray: { flexDirection: 'row', borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12 },
  cell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 2,
    borderRadius: 10,
  },
});

/**
 * Home's five-prayer strip as the D17 artboard draws it: a grey tray of five columns, the name
 * over the time, and the prayer whose time it is on a white pill in green. Before a city is
 * chosen the times read "--:--" and the strip opens Quran & Prayer to choose one.
 */
export function HomePrayerTimes({
  prayers,
  activeKey,
  activeLabel,
  onPress,
  accessibilityLabel,
  testID,
}: HomePrayerTimesProps) {
  const theme = useTheme();
  const w = useTextWeight();
  const c = theme.colors;
  const hc = theme.mode === 'highContrast';
  const said = (p: HomePrayer) =>
    p.key === activeKey ? `${activeLabel}: ${p.name} ${p.time}` : `${p.name} ${p.time}`;
  const tray = (
    <View
      role="list"
      style={[
        styles.tray,
        { backgroundColor: c.surfaceMuted },
        hc ? { borderWidth: 1, borderColor: c.borderStrong } : null,
      ]}
    >
      {prayers.map((p) => {
        const active = p.key === activeKey;
        return (
          <View
            key={p.key}
            role="listitem"
            aria-label={said(p)}
            testID={`home-prayer-${p.key}`}
            style={[
              styles.cell,
              active
                ? {
                    backgroundColor: c.surface,
                    boxShadow: theme.mode === 'light' ? elevation.low : undefined,
                    ...(hc ? { borderWidth: 1, borderColor: c.accent } : {}),
                  }
                : null,
            ]}
          >
            <Text
              color={active ? 'textAccent' : 'textSecondary'}
              align="center"
              numberOfLines={1}
              decorative
              variant="eyebrow"
              style={w(active ? '700' : '500', { letterSpacing: 0 })}
            >
              {p.name}
            </Text>
            <Text
              lang="en"
              direction="ltr"
              color={active ? 'text' : 'textMuted'}
              align="center"
              numberOfLines={1}
              decorative
              variant="eyebrow"
              style={[
                w(active ? '700' : '500', { lang: 'en', letterSpacing: 0 }),
                { marginTop: 1 },
              ]}
            >
              {p.time}
            </Text>
          </View>
        );
      })}
    </View>
  );
  if (!onPress) return <View testID={testID}>{tray}</View>;
  return (
    <Pressable
      role="button"
      // A button's name is all a screen reader says of it, so the times go in the name too.
      aria-label={[accessibilityLabel, ...prayers.map(said)].join(', ')}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => (pressed ? { opacity: 0.85 } : null)}
    >
      {tray}
    </Pressable>
  );
}
