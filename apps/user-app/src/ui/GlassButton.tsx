import { Pressable, StyleSheet, View } from 'react-native';
import { Badge, Icon, minTouchTarget, radii, useTheme, type IconName } from '@qc/ui';

export interface GlassButtonProps {
  icon: IconName;
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
 * `IconButton variant="onHero"`, with an unread count on the corner, which the kit button has
 * not got. TODO(kit): replace with IconButton onHero when it gains a count.
 */
export function GlassButton({
  icon,
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
      <Icon name={icon} size={22} color={c.textOnHero} />
      {count > 0 ? (
        <View style={styles.badge}>
          <Badge count={count} decorative />
        </View>
      ) : null}
    </Pressable>
  );
}
