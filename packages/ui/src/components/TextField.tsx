import { useId, useState } from 'react';
import { StyleSheet, TextInput, View, type KeyboardTypeOptions, type TextInputProps } from 'react-native';
import { textAlignStart, type Direction } from '../direction';
import { useTheme } from '../theme';
import { radii, spacing } from '../tokens';
import { Text } from './Text';

export interface TextFieldProps {
  /** Always visible above the field. A placeholder is never a label. */
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  helper?: string;
  /** The error message. Setting it puts the field in the error state and announces it. */
  error?: string;
  required?: boolean;
  disabled?: boolean;
  /** The field is read only while saving, and reports itself busy. */
  loading?: boolean;
  multiline?: boolean;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoComplete?: TextInputProps['autoComplete'];
  maxLength?: number;
  /**
   * The reading direction of what is typed. Default: the screen's. Use `ltr` for phone numbers
   * and codes on a right-to-left screen; they stay left-to-right but align to the line start.
   */
  contentDirection?: Direction;
  onBlur?: () => void;
  onSubmitEditing?: () => void;
  testID?: string;
}

const styles = StyleSheet.create({
  label: { marginBottom: spacing.xs },
  labelRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' },
  hint: { marginStart: spacing.sm },
  input: {
    minHeight: 56,
    borderWidth: 2,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  multiline: { minHeight: 120, textAlignVertical: 'top' },
  message: { marginTop: spacing.xs },
});

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  helper,
  error,
  required,
  disabled,
  loading,
  multiline,
  secureTextEntry,
  keyboardType,
  autoComplete,
  maxLength,
  contentDirection,
  onBlur,
  onSubmitEditing,
  testID,
}: TextFieldProps) {
  const theme = useTheme();
  const c = theme.colors;
  const [focused, setFocused] = useState(false);
  const id = useId();
  const messageId = `${id}-message`;
  const readOnly = Boolean(disabled || loading);
  const dir = contentDirection ?? theme.direction;
  const type = theme.type('body');
  const borderColor = error ? c.danger : focused ? c.focus : c.borderStrong;
  const message = error ?? helper;
  // `aria-*` props the native typings do not list are used by the web target only.
  const web = {
    dir,
    'aria-invalid': error ? true : undefined,
    'aria-required': required ? true : undefined,
    'aria-describedby': message ? messageId : undefined,
  };
  return (
    <View testID={testID ? `${testID}-field` : undefined}>
      <View style={[styles.labelRow, styles.label]}>
        <Text variant="label">{label}</Text>
        <Text variant="caption" color="textSecondary" style={styles.hint}>
          {required ? theme.t('ui.required') : theme.t('ui.optional')}
        </Text>
      </View>
      <TextInput
        testID={testID}
        {...web}
        aria-label={label}
        aria-disabled={disabled ? true : undefined}
        aria-busy={loading ? true : undefined}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.textMuted}
        editable={!readOnly}
        multiline={multiline}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoComplete={autoComplete}
        maxLength={maxLength}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          onBlur?.();
        }}
        onSubmitEditing={onSubmitEditing}
        style={[
          styles.input,
          multiline ? styles.multiline : undefined,
          type,
          {
            color: readOnly ? c.disabledText : c.text,
            backgroundColor: readOnly ? c.disabledBackground : c.surface,
            borderColor,
            textAlign: textAlignStart(dir),
          },
        ]}
      />
      {message ? (
        <View
          id={messageId}
          role={error ? 'alert' : undefined}
          aria-live={error ? 'polite' : undefined}
          style={styles.message}
        >
          <Text variant="caption" color={error ? 'textDanger' : 'textSecondary'}>
            {message}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
