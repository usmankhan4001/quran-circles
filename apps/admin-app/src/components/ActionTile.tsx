import { Pressable, View } from 'react-native';
import { Text, minTouchTarget, radii, spacing, useTheme } from '@qc/ui';
import { AppIcon, type AppIconName } from './glyphs';

export interface ActionTileProps {
  icon: AppIconName;
  label: string;
  onPress: () => void;
  /** Two tiles to a row instead of four, for the largest text sizes. */
  half?: boolean;
  testID?: string;
}

/**
 * One of the quick actions under the next session on Today, as drawn: a tinted tile with the
 * icon above a short label. Tiles share a row; at the two largest text sizes they wrap two by two.
 * TODO(kit): replace with a kit quick-action tile when one exists.
 */
export function ActionTile({ icon, label, onPress, half, testID }: ActionTileProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      role="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        flexGrow: 1,
        flexBasis: half ? '40%' : 0,
        minWidth: minTouchTarget + spacing.lg,
        minHeight: minTouchTarget + spacing.xl,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.xs,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: pressed ? colors.accent : colors.border,
        backgroundColor: pressed ? colors.accentSubtle : colors.surfaceMuted,
      })}
    >
      <View aria-hidden>
        <AppIcon name={icon} color={colors.accent} size={22} />
      </View>
      <Text variant="caption" color="textSecondary" align="center" decorative>
        {label}
      </Text>
    </Pressable>
  );
}
