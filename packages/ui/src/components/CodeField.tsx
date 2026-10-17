import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useTheme } from '../theme';
import { radii, spacing } from '../tokens';
import { Text } from './Text';

export interface CodeFieldProps {
  /** Said by screen readers and shown nowhere else, such as "6-digit code". */
  accessibilityLabel: string;
  value: string;
  /** Called with digits only. */
  onChangeText: (code: string) => void;
  length?: number;
  error?: string;
  onComplete?: (code: string) => void;
  testID?: string;
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  cell: {
    flex: 1,
    minHeight: 56,
    marginHorizontal: spacing.xs / 2,
    borderRadius: radii.field,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, opacity: 0.011 },
  message: { marginTop: spacing.xs },
});

/**
 * The one-time code (D9): one boxed cell per digit, always left to right, even in Urdu. A
 * single hidden input takes the typing, so paste and SMS autofill work.
 */
export function CodeField({
  accessibilityLabel,
  value,
  onChangeText,
  length = 6,
  error,
  onComplete,
  testID,
}: CodeFieldProps) {
  const theme = useTheme();
  const c = theme.colors;
  const [focused, setFocused] = useState(false);
  const digits = value.replace(/\D/g, '').slice(0, length);
  return (
    <View>
      <View style={styles.wrap}>
        <View style={[styles.row, { direction: 'ltr' }]} aria-hidden>
          {Array.from({ length }, (_, i) => {
            const active = focused && i === Math.min(digits.length, length - 1);
            return (
              <View
                key={i}
                style={[
                  styles.cell,
                  {
                    backgroundColor: c.surface,
                    borderWidth: error || active ? 2 : 1,
                    borderColor: error ? c.danger : active ? c.focus : c.borderStrong,
                  },
                ]}
              >
                <Text variant="title2" lang="en" direction="ltr" align="center" decorative>
                  {digits[i] ?? ''}
                </Text>
              </View>
            );
          })}
        </View>
        <TextInput
          testID={testID}
          aria-label={accessibilityLabel}
          aria-invalid={error ? true : undefined}
          value={digits}
          onChangeText={(text) => {
            const next = text.replace(/\D/g, '').slice(0, length);
            onChangeText(next);
            if (next.length === length) onComplete?.(next);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={length}
          caretHidden
          style={styles.input}
        />
      </View>
      {error ? (
        <View role="alert" aria-live="polite" style={styles.message}>
          <Text variant="caption" color="textDanger">
            {error}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
