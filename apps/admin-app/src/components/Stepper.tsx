import { StyleSheet, View } from 'react-native';
import { Button, Text, spacing } from '@qc/ui';
import { useT } from '../appearance/AppearanceProvider';

export interface StepperProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** The key action of the screen gets the big version. */
  large?: boolean;
  testID?: string;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  value: { minWidth: 72, alignItems: 'center' },
});

/**
 * Plus and minus around a number.
 * TODO(ui lane): replace with the kit's Stepper once it exists; see the change request
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
  return (
    <View testID={testID} role="group" aria-label={label} style={styles.row}>
      <Text variant={large ? 'bodyLarge' : 'label'}>{label}</Text>
      <View style={styles.row}>
        <Button
          testID={testID ? `${testID}-decrease` : undefined}
          label="−"
          variant="secondary"
          size={large ? 'large' : 'regular'}
          accessibilityLabel={t('admin.common.decrease', { label })}
          disabled={value <= min}
          onPress={() => onChange(Math.max(min, value - step))}
        />
        <View style={styles.value}>
          <Text
            testID={testID ? `${testID}-value` : undefined}
            variant={large ? 'title1' : 'title3'}
            align="center"
          >
            {n(value)}
          </Text>
        </View>
        <Button
          testID={testID ? `${testID}-increase` : undefined}
          label="+"
          variant="secondary"
          size={large ? 'large' : 'regular'}
          accessibilityLabel={t('admin.common.increase', { label })}
          disabled={value >= max}
          onPress={() => onChange(Math.min(max, value + step))}
        />
      </View>
    </View>
  );
}
