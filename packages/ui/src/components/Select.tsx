import { useId, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';
import { radii, spacing } from '../tokens';
import { Icon } from './Icon';
import { ListItem } from './ListItem';
import { Sheet } from './Sheet';
import { Text } from './Text';
import { Touchable } from './Touchable';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface SelectProps<T extends string> {
  label: string;
  options: readonly SelectOption<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
  placeholder?: string;
  helper?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  testID?: string;
}

const styles = StyleSheet.create({
  labelRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', marginBottom: spacing.xs },
  hint: { marginStart: spacing.sm },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    borderWidth: 2,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
  },
  value: { flex: 1, marginEnd: spacing.sm },
  message: { marginTop: spacing.xs },
});

/**
 * A single choice from a list. It looks like a text field and opens the options in a sheet,
 * which is easier to use than a dropdown with large text and on a phone.
 */
export function Select<T extends string>({
  label,
  options,
  value,
  onChange,
  placeholder,
  helper,
  error,
  required,
  disabled,
  testID,
}: SelectProps<T>) {
  const theme = useTheme();
  const c = theme.colors;
  const [open, setOpen] = useState(false);
  const id = useId();
  const selected = options.find((o) => o.value === value);
  const shown = selected?.label ?? placeholder ?? theme.t('ui.selectPlaceholder');
  const message = error ?? helper;
  return (
    <View>
      <View style={styles.labelRow}>
        <Text variant="label">{label}</Text>
        <Text variant="caption" color="textSecondary" style={styles.hint}>
          {required ? theme.t('ui.required') : theme.t('ui.optional')}
        </Text>
      </View>
      <Touchable
        testID={testID}
        role="combobox"
        expanded={open}
        disabled={disabled}
        accessibilityLabel={`${label}, ${shown}`}
        onPress={() => setOpen(true)}
        style={[
          styles.trigger,
          {
            backgroundColor: disabled ? c.disabledBackground : c.surface,
            borderColor: error ? c.danger : c.borderStrong,
          },
        ]}
      >
        <View style={styles.value}>
          <Text variant="body" color={disabled ? 'disabledText' : selected ? 'text' : 'textSecondary'}>
            {shown}
          </Text>
        </View>
        <Icon name="chevron-down" size={20} color={disabled ? c.disabledText : c.textSecondary} />
      </Touchable>
      {message ? (
        <View
          id={`${id}-message`}
          role={error ? 'alert' : undefined}
          aria-live={error ? 'polite' : undefined}
          style={styles.message}
        >
          <Text variant="caption" color={error ? 'textDanger' : 'textSecondary'}>
            {message}
          </Text>
        </View>
      ) : null}
      <Sheet visible={open} onClose={() => setOpen(false)} title={label} testID={testID ? `${testID}-sheet` : undefined}>
        <View role="radiogroup" aria-label={label}>
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <ListItem
                key={option.value}
                title={option.label}
                chevron={false}
                role="radio"
                checked={isSelected}
                selected={isSelected}
                disabled={option.disabled}
                accessibilityLabel={option.label}
                trailing={isSelected ? <Icon name="check" size={20} color={c.textAccent} /> : undefined}
                onPress={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                testID={testID ? `${testID}-option-${option.value}` : undefined}
              />
            );
          })}
        </View>
      </Sheet>
    </View>
  );
}
