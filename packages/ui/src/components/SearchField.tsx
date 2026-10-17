import { StyleSheet, TextInput, View } from 'react-native';
import { textAlignStart } from '../direction';
import { useTheme } from '../theme';
import { radii, spacing } from '../tokens';
import { Icon } from './Icon';
import { IconButton } from './IconButton';

export interface SearchFieldProps {
  /** The name a screen reader says, such as "Search circles". There is no visible label (D9). */
  accessibilityLabel: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onSubmitEditing?: () => void;
  /** Shown after the clear button, such as a filter `IconButton`. */
  trailing?: React.ReactNode;
  testID?: string;
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    borderRadius: radii.pill,
    paddingStart: spacing.lg,
    paddingEnd: spacing.xxs,
  },
  input: { flex: 1, minHeight: 48, marginStart: spacing.sm, borderWidth: 0 },
});

/** The search field (D9): pill-shaped, 52 tall, with a clear button once something is typed. */
export function SearchField({
  accessibilityLabel,
  value,
  onChangeText,
  placeholder,
  onSubmitEditing,
  trailing,
  testID,
}: SearchFieldProps) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <View
      style={[
        styles.box,
        {
          backgroundColor: c.surface,
          borderWidth: theme.mode === 'light' ? 0 : 1,
          borderColor: c.borderStrong,
        },
      ]}
    >
      <Icon name="search" size={20} color={c.textSecondary} />
      <TextInput
        testID={testID}
        role="searchbox"
        aria-label={accessibilityLabel}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.textMuted}
        returnKeyType="search"
        onSubmitEditing={onSubmitEditing}
        style={[
          styles.input,
          theme.type('body'),
          {
            color: c.text,
            backgroundColor: 'transparent',
            textAlign: textAlignStart(theme.direction),
          },
        ]}
      />
      {value ? (
        <IconButton
          icon="close"
          accessibilityLabel={theme.t('ui.clearSearch')}
          onPress={() => onChangeText('')}
        />
      ) : null}
      {trailing}
    </View>
  );
}
