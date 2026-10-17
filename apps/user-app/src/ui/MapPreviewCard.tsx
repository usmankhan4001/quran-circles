import { Pressable, StyleSheet, View } from 'react-native';
import { Text, elevation, radii, spacing, useTheme } from '@qc/ui';
import { Glyph } from './Glyph';

export interface MapPreviewCardProps {
  /** How many places to mark. */
  pins: number;
  title: string;
  caption?: string;
  onPress: () => void;
  testID?: string;
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.card, overflow: 'hidden', height: 148, justifyContent: 'flex-end' },
  pin: { position: 'absolute' },
  road: { position: 'absolute', height: spacing.sm, borderRadius: spacing.xs },
  caption: {
    margin: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    gap: spacing.xxs,
  },
});

// Where the pins sit, as shares of the card. Same spots every time so the card is calm.
const SPOTS = [
  { top: '14%', start: '18%' },
  { top: '30%', start: '62%' },
  { top: '8%', start: '44%' },
  { top: '38%', start: '30%' },
  { top: '22%', start: '80%' },
] as const;

/**
 * The map card of Home (H4): a calm picture of a map with the places marked, that opens the
 * real map on Nearby. It is drawn, not a map: no tiles are loaded on Home.
 * TODO(kit): replace with the @qc/ui map pieces when the ui lane exports them.
 */
export function MapPreviewCard({ pins, title, caption, onPress, testID }: MapPreviewCardProps) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <Pressable
      role="button"
      aria-label={[title, caption].filter(Boolean).join(', ')}
      testID={testID}
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: c.accentSubtle,
          boxShadow: theme.mode === 'light' ? elevation.low : undefined,
        },
      ]}
    >
      <View
        aria-hidden
        style={[
          styles.road,
          {
            backgroundColor: c.surface,
            top: '44%',
            start: -8,
            end: -8,
            transform: [{ rotate: '-8deg' }],
          },
        ]}
      />
      <View
        aria-hidden
        style={[
          styles.road,
          {
            backgroundColor: c.surface,
            top: '18%',
            start: '30%',
            width: '60%',
            transform: [{ rotate: '24deg' }],
          },
        ]}
      />
      {SPOTS.slice(0, Math.max(1, Math.min(pins, SPOTS.length))).map((spot, index) => (
        <View key={index} aria-hidden style={[styles.pin, spot]}>
          <Glyph name="pin" size={28} color={c.accent} />
        </View>
      ))}
      <View style={[styles.caption, { backgroundColor: c.surface }]}>
        <Text variant="label">{title}</Text>
        {caption ? (
          <Text variant="caption" color="textSecondary">
            {caption}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
