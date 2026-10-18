import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, Text, elevation, minTouchTarget, radii, spacing, useTheme } from '@qc/ui';

export interface SearchButtonProps {
  /** The name a screen reader says. */
  label: string;
  placeholder: string;
  onPress: () => void;
  testID?: string;
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: minTouchTarget + spacing.xs,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
  },
  grow: { flex: 1 },
});

/**
 * Home's search bar looks like the kit's `SearchField` but is a button that opens Nearby,
 * where the real field is. TODO(kit): a link variant of @qc/ui SearchField would replace this.
 */
export function SearchButton({ label, placeholder, onPress, testID }: SearchButtonProps) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <Pressable
      role="button"
      aria-label={`${label}. ${placeholder}`}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: pressed ? c.surfaceMuted : c.surface,
          borderWidth: 1,
          borderColor: theme.mode === 'light' ? 'transparent' : c.borderStrong,
          boxShadow: theme.mode === 'light' ? elevation.low : undefined,
          transform: pressed && !theme.reduceMotion ? [{ scale: 0.995 }] : undefined,
        },
      ]}
    >
      <Icon name="search" size={20} color={c.textAccent} />
      <View style={styles.grow}>
        <Text variant="body" color="textSecondary" numberOfLines={1}>
          {placeholder}
        </Text>
      </View>
    </Pressable>
  );
}
