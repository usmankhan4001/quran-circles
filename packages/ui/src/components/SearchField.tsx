import { StyleSheet, TextInput, View } from 'react-native';
import { textAlignStart } from '../direction';
import { useTheme } from '../theme';
import { elevation, radii, spacing } from '../tokens';
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
    paddingEnd: spacing.xs,
  },
  // `minWidth: 0` lets the field shrink below the browser's default input width, so it fits
  // a 320 px screen at the largest text size (A-06).
  input: { flex: 1, minWidth: 0, minHeight: 48, marginStart: spacing.sm, borderWidth: 0 },
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
          // In light mode the edge is transparent: it shows only in forced colours (Windows
          // high contrast), where the field would otherwise have no edge at all (A-07).
          borderWidth: 1,
          borderColor: theme.mode === 'light' ? 'transparent' : c.borderStrong,
          boxShadow: theme.mode === 'light' ? elevation.low : undefined,
        },
      ]}
    >
      <Icon name="search" size={20} color={c.textAccent} />
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
