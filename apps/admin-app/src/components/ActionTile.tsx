import { Pressable, View } from 'react-native';
import { Text, minTouchTarget, radii, spacing, useTheme } from '@qc/ui';
import { AppIcon, type AppIconName } from './glyphs';

export interface ActionTileProps {
  icon: AppIconName;
  label: string;
  /** A short line under the label: what the action is about now, never a made-up number. */
  sub?: string;
  onPress: () => void;
  /** One tile to a row instead of two, for the largest text sizes. */
  wide?: boolean;
  testID?: string;
}

/**
 * D17 quick action: a white tile with an emerald-tint icon square, the label and a short line
 * under it. Two to a row; one to a row at the two largest text sizes.
 * TODO(kit): replace with a kit quick-action tile when one exists.
 */
export function ActionTile({ icon, label, sub, onPress, wide, testID }: ActionTileProps) {
  const { colors, mode } = useTheme();
  return (
    <Pressable
      testID={testID}
      role="button"
      accessibilityLabel={sub ? `${label}, ${sub}` : label}
      onPress={onPress}
      style={({ pressed }) => ({
        flexGrow: 1,
        flexBasis: wide ? '100%' : '40%',
        minHeight: minTouchTarget + spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: mode === 'highContrast' ? colors.borderStrong : colors.hairline,
        backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
      })}
    >
      <View
        aria-hidden
        style={{
          width: 36,
          height: 36,
          borderRadius: radii.md,
          backgroundColor: colors.accentSubtle,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AppIcon name={icon} color={colors.textOnAccentSubtle} size={19} weight="duotone" />
      </View>
      <View style={{ flex: 1, gap: 0 }}>
        <Text variant="caption" decorative strong>
          {label}
        </Text>
        {sub ? (
          <Text variant="caption" color="textSecondary" numberOfLines={2} decorative>
            {sub}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
