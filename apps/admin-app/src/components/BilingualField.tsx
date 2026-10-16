import { View } from 'react-native';
import { TextField, spacing } from '@qc/ui';
import { useT } from '../appearance/AppearanceProvider';
import type { BilingualFields } from '../lib/localized';

export interface BilingualFieldProps {
  label: string;
  value: BilingualFields;
  onChange: (value: BilingualFields) => void;
  /** At least one language is needed. The Urdu text stands in for English when English is empty. */
  required?: boolean;
  multiline?: boolean;
  error?: string;
  maxLength?: number;
  disabled?: boolean;
  testID?: string;
}

/** The same text in English and in Urdu, one box each. Urdu is typed right to left. */
export function BilingualField({
  label,
  value,
  onChange,
  required,
  multiline,
  error,
  maxLength,
  disabled,
  testID,
}: BilingualFieldProps) {
  const { t } = useT();
  return (
    <View style={{ gap: spacing.md }}>
      <TextField
        testID={testID ? `${testID}-en` : undefined}
        label={`${label} (${t('admin.common.english')})`}
        value={value.en}
        onChangeText={(en) => onChange({ ...value, en })}
        multiline={multiline}
        required={required}
        error={error}
        maxLength={maxLength}
        disabled={disabled}
        contentDirection="ltr"
      />
      <TextField
        testID={testID ? `${testID}-ur` : undefined}
        label={`${label} (${t('admin.common.urdu')})`}
        value={value.ur}
        onChangeText={(ur) => onChange({ ...value, ur })}
        multiline={multiline}
        maxLength={maxLength}
        disabled={disabled}
        contentDirection="rtl"
      />
    </View>
  );
}
