import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, Text, minTouchTarget, radii, spacing, useTheme } from '@qc/ui';

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
    minHeight: minTouchTarget,
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
          // D17: a grey pill with a hairline, like the kit's SearchField.
          backgroundColor: pressed ? c.border : c.surfaceMuted,
          borderWidth: 1,
          borderColor: theme.mode === 'highContrast' ? c.borderStrong : c.border,
          transform: pressed && !theme.reduceMotion ? [{ scale: 0.995 }] : undefined,
        },
      ]}
    >
      <Icon name="search" size={20} color={c.textSecondary} />
      <View style={styles.grow}>
        <Text variant="body" color="textSecondary" numberOfLines={1}>
          {placeholder}
        </Text>
      </View>
    </Pressable>
  );
}
