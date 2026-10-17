import { Pressable, View } from 'react-native';
import { Icon, Text, minTouchTarget, radii, spacing, useTheme } from '@qc/ui';
import { Glyph, type GlyphName } from './glyphs';

export interface QuickActionProps {
  glyph: GlyphName;
  label: string;
  onPress: () => void;
  testID?: string;
}

/**
 * A wide tinted tile for a main action, with a round icon, the label and an arrow.
 * TODO(kit): replace with a kit quick-action tile when one exists.
 */
export function QuickAction({ glyph, label, onPress, testID }: QuickActionProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      role="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: minTouchTarget + spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        borderRadius: radii.card,
        backgroundColor: pressed ? colors.accentSubtle : colors.surfaceMuted,
      })}
    >
      <View
        style={{
          width: minTouchTarget,
          height: minTouchTarget,
          borderRadius: radii.pill,
          backgroundColor: colors.accent,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Glyph name={glyph} color={colors.textOnAccent} size={22} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="label" decorative>
          {label}
        </Text>
      </View>
      <Icon name="chevron-forward" size={20} color={colors.textSecondary} />
    </Pressable>
  );
}
