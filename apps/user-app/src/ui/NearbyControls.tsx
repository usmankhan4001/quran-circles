import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Icon, Text, elevation, radii, textAlignStart, useTheme, type IconName } from '@qc/ui';
import { useTextWeight } from './textWeight';

/**
 * Nearby's header controls as the D17 artboard draws them: chips 6 × 12 inside with the
 * caption role, the List / Map switch on a grey track, and a 38 dp search pill. The kit's
 * `Chip`, `SegmentedControl` and `SearchField` are 48–52 dp tall, a size up from the drawing,
 * so these keep the drawn size and reach 48 dp of press area with slop.
 */

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  remove: { marginStart: 2 },
  track: { flexDirection: 'row', padding: 3, borderRadius: radii.pill },
  option: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: radii.pill },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: 16,
    minHeight: 40,
  },
  input: { flex: 1, minWidth: 0, minHeight: 38, padding: 0, borderWidth: 0 },
});

export interface NearbyChipProps {
  label: string;
  /** `place`: the charcoal chip that starts the row. `chosen`: a filter that is on. */
  kind?: 'place' | 'chosen' | 'plain';
  icon?: IconName;
  /** A toggle chip says whether it is on; a plain one is a button. */
  checked?: boolean;
  onPress?: () => void;
  /** Takes the filter off: drawn as a small cross after the label. */
  onRemove?: () => void;
  removeLabel?: string;
  testID?: string;
}

export function NearbyChip({
  label,
  kind = 'plain',
  icon,
  checked,
  onPress,
  onRemove,
  removeLabel,
  testID,
}: NearbyChipProps) {
  const theme = useTheme();
  const w = useTextWeight();
  const c = theme.colors;
  const hc = theme.mode === 'highContrast';
  const look =
    kind === 'place'
      ? {
          bg: c.cta,
          pressed: c.ctaPressed,
          fg: 'textOnCta' as const,
          border: hc ? c.borderStrong : c.cta,
        }
      : kind === 'chosen'
        ? {
            bg: c.accentSubtle,
            pressed: c.border,
            fg: 'textOnAccentSubtle' as const,
            border: hc ? c.accent : c.accentSubtle,
          }
        : {
            bg: c.surface,
            pressed: c.surfaceMuted,
            fg: 'textSecondary' as const,
            border: hc ? c.borderStrong : c.border,
          };
  return (
    <View style={[styles.chip, { backgroundColor: look.bg, borderColor: look.border }]}>
      <Pressable
        role={checked === undefined ? 'button' : 'checkbox'}
        aria-checked={checked}
        testID={testID}
        onPress={onPress}
        hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          opacity: pressed ? 0.75 : 1,
        })}
      >
        {icon ? (
          <Icon name={icon} size={12} color={kind === 'place' ? c.progress : c[look.fg]} />
        ) : null}
        <Text variant="caption" color={look.fg} numberOfLines={1} style={w('600')}>
          {label}
        </Text>
      </Pressable>
      {onRemove ? (
        <Pressable
          role="button"
          aria-label={removeLabel ?? theme.t('ui.remove', { name: label })}
          onPress={onRemove}
          hitSlop={{ top: 10, bottom: 10, left: 6, right: 10 }}
          style={styles.remove}
        >
          <Icon name="close" size={11} color={c[look.fg]} />
        </Pressable>
      ) : null}
    </View>
  );
}

export interface ViewSwitchProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: string }[];
  accessibilityLabel: string;
  testID?: string;
}

/** The List / Map switch: a white pill on a grey track (Nearby artboard 01). */
export function ViewSwitch<T extends string>({
  value,
  onChange,
  options,
  accessibilityLabel,
  testID,
}: ViewSwitchProps<T>) {
  const theme = useTheme();
  const w = useTextWeight();
  const c = theme.colors;
  return (
    <View
      role="radiogroup"
      aria-label={accessibilityLabel}
      testID={testID}
      style={[
        styles.track,
        { backgroundColor: c.hairline },
        theme.mode === 'highContrast' ? { borderWidth: 1, borderColor: c.borderStrong } : null,
      ]}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            role="radio"
            aria-checked={on}
            onPress={() => onChange(o.value)}
            hitSlop={{ top: 10, bottom: 10 }}
            style={[
              styles.option,
              on
                ? {
                    backgroundColor: c.surface,
                    boxShadow: theme.mode === 'light' ? elevation.low : undefined,
                    ...(theme.mode === 'highContrast'
                      ? { borderWidth: 1, borderColor: c.accent }
                      : {}),
                  }
                : null,
            ]}
          >
            <Text
              variant="caption"
              color={on ? 'text' : 'textSecondary'}
              style={w(on ? '700' : '600')}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export interface NearbySearchProps {
  accessibilityLabel: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  clearLabel: string;
  testID?: string;
}

/** The search pill (Nearby artboard 01): grey, a hairline, a 16 dp glass, 16 inside. */
export function NearbySearch({
  accessibilityLabel,
  placeholder,
  value,
  onChangeText,
  clearLabel,
  testID,
}: NearbySearchProps) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <View
      style={[
        styles.search,
        {
          backgroundColor: c.surfaceMuted,
          borderColor: theme.mode === 'light' ? c.border : c.borderStrong,
        },
      ]}
    >
      <Icon name="search" size={16} color={c.textSecondary} />
      <TextInput
        testID={testID}
        role="searchbox"
        aria-label={accessibilityLabel}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.textSecondary}
        returnKeyType="search"
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
        <Pressable
          role="button"
          aria-label={clearLabel}
          onPress={() => onChangeText('')}
          hitSlop={14}
        >
          <Icon name="close" size={14} color={c.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}
