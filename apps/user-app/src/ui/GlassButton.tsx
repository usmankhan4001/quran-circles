import { Pressable, StyleSheet, View } from 'react-native';
import { Badge, minTouchTarget, radii, useTheme } from '@qc/ui';
import { Glyph, type GlyphName } from './Glyph';

export interface GlassButtonProps {
  glyph: GlyphName;
  /** Required: a picture alone has no name for a screen reader. */
  accessibilityLabel: string;
  onPress: () => void;
  /** An unread count shown on the corner. Zero shows nothing. */
  count?: number;
  testID?: string;
}

const styles = StyleSheet.create({
  button: {
    width: minTouchTarget,
    height: minTouchTarget,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: { position: 'absolute', top: 2, end: 2 },
});

/**
 * A round-cornered glass button for the green header, such as the bell. Same look as the kit's
 * `IconButton variant="onHero"`, with a picture the kit icon set does not have yet.
 * TODO(kit): replace with IconButton onHero and a bell icon when the ui lane adds them.
 */
export function GlassButton({
  glyph,
  accessibilityLabel,
  onPress,
  count = 0,
  testID,
}: GlassButtonProps) {
  const c = useTheme().colors;
  return (
    <Pressable
      role="button"
      aria-label={accessibilityLabel}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: pressed ? c.heroGlassPressed : c.heroGlass },
      ]}
    >
      <Glyph name={glyph} size={22} color={c.textOnHero} />
      {count > 0 ? (
        <View style={styles.badge}>
          <Badge count={count} decorative />
        </View>
      ) : null}
    </Pressable>
  );
}
