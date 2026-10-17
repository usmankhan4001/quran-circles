import { Pressable, StyleSheet, View } from 'react-native';
import { Text, minTouchTarget, radii, spacing, useTheme } from '@qc/ui';
import { Glyph } from './Glyph';

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
      style={[
        styles.button,
        {
          backgroundColor: c.surface,
          borderWidth: theme.mode === 'light' ? 0 : 1,
          borderColor: c.borderStrong,
        },
      ]}
    >
      <Glyph name="search" size={22} color={c.textSecondary} />
      <View style={styles.grow}>
        <Text variant="body" color="textSecondary" numberOfLines={1}>
          {placeholder}
        </Text>
      </View>
    </Pressable>
  );
}
