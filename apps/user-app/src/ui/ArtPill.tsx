import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, Text, radii, useTheme, type IconName } from '@qc/ui';

export interface ArtPillProps {
  label: string;
  onPress: () => void;
  /** `outline`: white with a hairline (Directions). `primary`: the charcoal call to action. */
  variant?: 'outline' | 'primary';
  icon?: IconName;
  trailingIcon?: IconName;
  accessibilityLabel?: string;
  testID?: string;
}

/** Drawn 40 high (`.iq-pill-cta`); the press area reaches 48 dp with the slop. */
const HEIGHT = 40;
const SLOP = 4;

const styles = StyleSheet.create({
  pill: {
    minHeight: HEIGHT,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  label: { flexShrink: 1 },
});

/**
 * The 40 dp pill button of the D17 cards (`.iq-pill-cta`): the label role, a 14 dp icon. The
 * kit `Button` is 48 high, taller than the drawn pill, so the cards on
 * Home and Nearby use this one. It grows with the text size.
 */
export function ArtPill({
  label,
  onPress,
  variant = 'outline',
  icon,
  trailingIcon,
  accessibilityLabel,
  testID,
}: ArtPillProps) {
  const theme = useTheme();
  const c = theme.colors;
  const primary = variant === 'primary';
  const fg = primary ? c.textOnCta : c.text;
  return (
    <Pressable
      role="button"
      aria-label={accessibilityLabel ?? label}
      testID={testID}
      onPress={onPress}
      hitSlop={SLOP}
      style={({ pressed }) => [
        styles.pill,
        {
          backgroundColor: primary
            ? pressed
              ? c.ctaPressed
              : c.cta
            : pressed
              ? c.surfaceMuted
              : c.surface,
          borderColor: primary ? c.cta : theme.mode === 'highContrast' ? c.borderStrong : c.border,
          transform: pressed && !theme.reduceMotion ? [{ scale: 0.98 }] : undefined,
        },
      ]}
    >
      {icon ? <Icon name={icon} size={14} color={fg} /> : null}
      <View style={styles.label}>
        <Text
          color={primary ? 'textOnCta' : 'text'}
          align="center"
          numberOfLines={2}
          decorative
          variant="label"
        >
          {label}
        </Text>
      </View>
      {trailingIcon ? <Icon name={trailingIcon} size={13} color={fg} /> : null}
    </Pressable>
  );
}
