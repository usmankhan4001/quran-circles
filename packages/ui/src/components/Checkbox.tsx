import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';
import { radii, spacing } from '../tokens';
import { Icon } from './Icon';
import { Text } from './Text';
import { Touchable } from './Touchable';

export interface CheckboxProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  testID?: string;
}

const BOX = 28;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingVertical: spacing.sm },
  box: {
    width: BOX,
    height: BOX,
    borderRadius: radii.sm - 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginEnd: spacing.lg,
  },
  text: { flex: 1 },
});

/**
 * A labelled tick box. The whole row is the touch target. A tick mark shows the checked state,
 * so it does not depend on colour. Used for the facilities checklist and the attendance list.
 */
export function Checkbox({
  label,
  description,
  checked,
  onChange,
  disabled,
  testID,
}: CheckboxProps) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <Touchable
      testID={testID}
      role="checkbox"
      checked={checked}
      disabled={disabled}
      accessibilityLabel={description ? `${label}. ${description}` : label}
      onPress={() => onChange(!checked)}
      style={({ pressed }) => [
        styles.row,
        pressed ? { backgroundColor: c.surfaceMuted } : undefined,
      ]}
    >
      <View
        aria-hidden
        style={[
          styles.box,
          {
            backgroundColor: disabled ? c.disabledBackground : checked ? c.accent : c.surface,
            borderColor: disabled ? c.disabledText : checked ? c.accent : c.borderStrong,
          },
        ]}
      >
        {checked ? (
          <Icon name="check" size={18} color={disabled ? c.disabledText : c.textOnAccent} />
        ) : null}
      </View>
      <View style={styles.text}>
        <Text variant="body" color={disabled ? 'disabledText' : 'text'}>
          {label}
        </Text>
        {description ? (
          <Text variant="caption" color={disabled ? 'disabledText' : 'textSecondary'}>
            {description}
          </Text>
        ) : null}
      </View>
    </Touchable>
  );
}
