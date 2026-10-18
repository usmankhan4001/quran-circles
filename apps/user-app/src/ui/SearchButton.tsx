import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, Text, radii, spacing, useTheme } from '@qc/ui';

export interface SearchButtonProps {
  /** The name a screen reader says. */
  label: string;
  placeholder: string;
  onPress: () => void;
  testID?: string;
}

const styles = StyleSheet.create({
  // As drawn on Home: 42 high, 14 inside, an 8 dp gap (the press area reaches 48 with the slop).
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 42,
    paddingHorizontal: 14,
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
      hitSlop={3}
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
      <Icon name="search" size={16} color={c.textSecondary} />
      <View style={styles.grow}>
        <Text color="textSecondary" numberOfLines={1} variant="body">
          {placeholder}
        </Text>
      </View>
    </Pressable>
  );
}
