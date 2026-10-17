import { Pressable, StyleSheet, View } from 'react-native';
import { Badge, Icon, Text, minTouchTarget, spacing, useTheme, type IconName } from '@qc/ui';

export interface ShortcutProps {
  icon: IconName;
  label: string;
  onPress: () => void;
  /** An unread count on the corner. Zero shows nothing. */
  count?: number;
  /** What a screen reader says, when it should say more than the label (the unread count). */
  accessibilityLabel?: string;
  testID?: string;
}

const SIZE = 56;

const s = StyleSheet.create({
  button: { flex: 1, alignItems: 'center', gap: spacing.xs, minHeight: minTouchTarget },
  circle: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: { position: 'absolute', top: -2, end: -2 },
});

/**
 * A round shortcut with its name under it (H4 extras: Quran, Prayer times, Qibla, Updates).
 * TODO(kit): replace with an @qc/ui shortcut when the ui lane adds one.
 */
export function Shortcut({
  icon,
  label,
  onPress,
  count = 0,
  accessibilityLabel,
  testID,
}: ShortcutProps) {
  const c = useTheme().colors;
  return (
    <Pressable
      role="button"
      aria-label={accessibilityLabel ?? label}
      testID={testID}
      onPress={onPress}
      style={s.button}
    >
      {({ pressed }) => (
        <>
          <View
            style={[
              s.circle,
              {
                backgroundColor: pressed ? c.accent : c.accentSubtle,
                borderWidth: 1,
                borderColor: c.border,
              },
            ]}
          >
            <Icon name={icon} size={26} color={pressed ? c.textOnAccent : c.textOnAccentSubtle} />
            {count > 0 ? (
              <View style={s.badge}>
                <Badge count={count} decorative />
              </View>
            ) : null}
          </View>
          <Text variant="caption" align="center" decorative>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}
