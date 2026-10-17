import { View } from 'react-native';
import { Text, radii, spacing, useTheme } from '@qc/ui';

export type TagTone = 'neutral' | 'success' | 'warning' | 'danger' | 'accent';

/**
 * A small coloured label, for example Draft or Cancelled.
 * TODO(kit): replace with @qc/ui Tag.
 */
export function Tag({
  label,
  tone = 'neutral',
  testID,
}: {
  label: string;
  tone?: TagTone;
  testID?: string;
}) {
  const { colors } = useTheme();
  const bg = {
    neutral: colors.surfaceMuted,
    success: colors.successSubtle,
    warning: colors.warningSubtle,
    danger: colors.dangerSubtle,
    accent: colors.accentSubtle,
  }[tone];
  const fg = {
    neutral: 'textSecondary',
    success: 'textOnSuccessSubtle',
    warning: 'textOnWarningSubtle',
    danger: 'textOnDangerSubtle',
    accent: 'textOnAccentSubtle',
  }[tone] as 'textSecondary';
  return (
    <View
      testID={testID}
      style={{
        alignSelf: 'flex-start',
        backgroundColor: bg,
        borderRadius: radii.pill,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
      }}
    >
      <Text variant="caption" color={fg} strong>
        {label}
      </Text>
    </View>
  );
}
