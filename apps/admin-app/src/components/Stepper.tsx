import { StyleSheet, View } from 'react-native';
import { Text, spacing } from '@qc/ui';
import { useT } from '../appearance/AppearanceProvider';
import { RoundButton } from './RoundButton';

export interface StepperProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** The key action of the screen gets the big version: the number centred under the label. */
  large?: boolean;
  testID?: string;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  big: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xl },
  value: { minWidth: 72, alignItems: 'center' },
});

/**
 * Minus and plus around a number, with round tinted buttons.
 * TODO(kit): replace with @qc/ui Stepper once the kit has one; see the change request
 * docs/engineering/change-requests/2026-10-16-admin-app-kit-needs.md.
 */
export function Stepper({
  label,
  value,
  onChange,
  min = 0,
  max = 9999,
  step = 1,
  large,
  testID,
}: StepperProps) {
  const { t, n } = useT();
  const controls = (
    <View style={large ? styles.big : styles.row}>
      <RoundButton
        testID={testID ? `${testID}-decrease` : undefined}
        icon="minus"
        size={large ? 'large' : 'regular'}
        accessibilityLabel={t('admin.common.decrease', { label })}
        disabled={value <= min}
        onPress={() => onChange(Math.max(min, value - step))}
      />
      <View style={styles.value}>
        <Text
          testID={testID ? `${testID}-value` : undefined}
          variant={large ? 'display' : 'title3'}
          color={large ? 'textAccent' : 'text'}
          align="center"
        >
          {n(value)}
        </Text>
      </View>
      <RoundButton
        testID={testID ? `${testID}-increase` : undefined}
        icon="plus"
        size={large ? 'large' : 'regular'}
        accessibilityLabel={t('admin.common.increase', { label })}
        disabled={value >= max}
        onPress={() => onChange(Math.min(max, value + step))}
      />
    </View>
  );
  return (
    <View testID={testID} role="group" aria-label={label} style={{ gap: spacing.sm }}>
      {large ? (
        controls
      ) : (
        <View style={styles.row}>
          <Text variant="label" style={{ flex: 1 }}>
            {label}
          </Text>
          {controls}
        </View>
      )}
    </View>
  );
}
