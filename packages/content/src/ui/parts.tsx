import type { ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  Icon,
  Text,
  elevation,
  formatNumber,
  minTouchTarget,
  radii,
  spacing,
  useTheme,
  type IconName,
} from '@qc/ui';

// Small pieces of the showcase artboards (D17 override) that the Quran and prayer screens share.

/** A white card with the hairline and whisper shadow (`.iq-white-card`), any radius and padding. */
export function WhiteCard({
  children,
  radius = radii.card,
  padding = 18,
  outlined,
  style,
  testID,
}: {
  children: ReactNode;
  radius?: number;
  padding?: number;
  /** The chosen look: an emerald outline (the current prayer, the ayah asked for). */
  outlined?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const theme = useTheme();
  const c = theme.colors;
  const hc = theme.mode === 'highContrast';
  return (
    <View
      testID={testID}
      style={[
        {
          backgroundColor: c.surface,
          borderRadius: radius,
          borderWidth: outlined ? 1.5 : 1,
          borderColor: outlined ? c.progress : hc ? c.borderStrong : c.hairline,
          boxShadow: theme.mode === 'light' ? elevation.low : undefined,
          padding,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** The 6 px green dot and short bold line that opens a lead card. */
export function StatusLine({ label, testID }: { label: string; testID?: string }) {
  const c = useTheme().colors;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 }}>
      <View
        aria-hidden
        style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.progress }}
      />
      <Text variant="caption" color="textAccent" strong testID={testID}>
        {label}
      </Text>
    </View>
  );
}

/**
 * The white outline pill with a forward arrow (`.iq-pill-cta`). It is drawn 36 to 40 tall as on
 * the artboard; the touch area reaches 48 dp.
 */
export function PillCta({
  label,
  onPress,
  height = 40,
  small,
  accessibilityLabel,
  testID,
}: {
  label: string;
  onPress: () => void;
  height?: number;
  /** The smaller pill of the mini cards: caption text. */
  small?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const theme = useTheme();
  const c = theme.colors;
  const slop = Math.max(0, Math.ceil((minTouchTarget - height) / 2));
  return (
    <Pressable
      role="button"
      aria-label={accessibilityLabel}
      onPress={onPress}
      hitSlop={slop}
      testID={testID}
      style={({ pressed }) => ({
        minHeight: Math.round(height * theme.scale),
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: theme.mode === 'highContrast' ? c.borderStrong : c.border,
        backgroundColor: pressed ? c.surfaceMuted : c.surface,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingHorizontal: spacing.md,
      })}
    >
      <Text variant={small ? 'caption' : 'label'} strong>
        {label}
      </Text>
      <Icon name="arrow-right" size={small ? 12 : 14} color={c.text} />
    </Pressable>
  );
}

/** A section title with an optional quiet link at the end (`.iq-section-head`). */
export function SectionHead({
  title,
  more,
  onMore,
  moreTestID,
}: {
  title: string;
  more?: string;
  onMore?: () => void;
  moreTestID?: string;
}) {
  const c = useTheme().colors;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.sm,
        marginBottom: 8,
      }}
    >
      <Text variant="title3" heading={2}>
        {title}
      </Text>
      {more && onMore ? (
        <Pressable
          role="link"
          onPress={onMore}
          testID={moreTestID}
          style={{ minHeight: minTouchTarget, flexDirection: 'row', alignItems: 'center', gap: 3 }}
        >
          <Text variant="caption" color="textSecondary" strong>
            {more}
          </Text>
          <Icon name="caret-right" weight="bold" size={11} color={c.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * The compact tabs of the Quran list (Surahs, Juz, Saved): a soft grey pill track sized to its
 * labels, the chosen tab a white pill with a whisper shadow.
 */
export function PillTabs<T extends string>({
  value,
  onChange,
  options,
  accessibilityLabel,
  testID,
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: string }[];
  accessibilityLabel: string;
  testID?: string;
}) {
  const theme = useTheme();
  const c = theme.colors;
  const hc = theme.mode === 'highContrast';
  return (
    <View
      role="radiogroup"
      aria-label={accessibilityLabel}
      testID={testID}
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignSelf: 'flex-start',
        flexShrink: 1,
        padding: 3,
        borderRadius: radii.pill,
        backgroundColor: c.surfaceMuted,
        borderWidth: hc ? 1 : 0,
        borderColor: c.borderStrong,
      }}
    >
      {options.map((option) => {
        const chosen = option.value === value;
        return (
          <Pressable
            key={option.value}
            role="radio"
            aria-checked={chosen}
            onPress={() => onChange(option.value)}
            hitSlop={{ top: 12, bottom: 12, left: 0, right: 0 }}
            testID={testID ? `${testID}-${option.value}` : undefined}
            style={({ pressed }) => ({
              paddingVertical: 4,
              paddingHorizontal: chosen ? 12 : 11,
              borderRadius: radii.pill,
              backgroundColor: chosen ? c.surface : pressed ? c.border : 'transparent',
              borderWidth: chosen && hc ? 2 : 0,
              borderColor: c.borderStrong,
              boxShadow:
                chosen && theme.mode === 'light' ? '0px 1px 3px rgba(0,0,0,0.06)' : undefined,
            })}
          >
            <Text variant="caption" strong={chosen} color={chosen ? 'text' : 'textSecondary'}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The 30 px round grey button beside the tabs (search), with a 48 dp touch area. */
export function RoundButton({
  icon,
  accessibilityLabel,
  onPress,
  testID,
}: {
  icon: 'search' | 'close';
  accessibilityLabel: string;
  onPress: () => void;
  testID?: string;
}) {
  const c = useTheme().colors;
  return (
    <Pressable
      role="button"
      aria-label={accessibilityLabel}
      onPress={onPress}
      hitSlop={9}
      testID={testID}
      style={({ pressed }) => ({
        width: 30,
        height: 30,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: pressed ? c.border : c.background,
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      <Icon
        name={icon === 'search' ? 'magnifying-glass' : 'x'}
        weight="bold"
        size={13}
        color={c.textSecondary}
      />
    </Pressable>
  );
}

/**
 * The ayah medallion of the artboards: a number in the eight-point star (as the kit's
 * StarNumber), drawn at the artboard's size (24 to 26 px). It grows with the text size.
 * TODO(ui lane): a `size` prop on the kit's StarNumber would replace this.
 */
export function Medallion({
  value,
  px = 26,
  accessibilityLabel,
  testID,
}: {
  value: number;
  px?: number;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const theme = useTheme();
  const c = theme.colors;
  const size = Math.round(px * theme.scale);
  const side = Math.round(size * 0.68);
  const disc = Math.round(size * 0.58);
  const square = {
    position: 'absolute',
    width: side,
    height: side,
    borderWidth: 1.25,
    borderRadius: 2,
    borderColor: c.textAccent,
    backgroundColor: c.accentSubtle,
  } as const;
  const digits = formatNumber(value, theme.locale);
  return (
    <View
      testID={testID}
      role={accessibilityLabel ? 'img' : undefined}
      aria-label={accessibilityLabel}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <View aria-hidden style={square} />
      <View aria-hidden style={[square, { transform: [{ rotate: '45deg' }] }]} />
      <View
        aria-hidden
        style={{
          position: 'absolute',
          width: disc,
          height: disc,
          borderRadius: disc / 2,
          backgroundColor: c.accentSubtle,
          borderWidth: theme.mode === 'highContrast' ? 0 : 1,
          borderColor: c.decoration,
        }}
      />
      <Text
        variant="eyebrow"
        color="textAccent"
        lang="en"
        direction="ltr"
        strong
        align="center"
        decorative={Boolean(accessibilityLabel)}
        style={{
          fontSize: Math.round(size * (digits.length > 2 ? 0.3 : 0.36)),
          lineHeight: Math.round(size * 0.5),
          letterSpacing: 0,
        }}
      >
        {digits}
      </Text>
    </View>
  );
}

/** A small icon button of a top bar: the icon at the artboard's 17 px, a 48 dp touch area. */
export function BarIcon({
  icon,
  accessibilityLabel,
  onPress,
  disabled,
  strong,
  testID,
}: {
  icon: IconName;
  accessibilityLabel: string;
  onPress?: () => void;
  disabled?: boolean;
  /** The back caret is bold and in the text colour, as drawn. */
  strong?: boolean;
  testID?: string;
}) {
  const c = useTheme().colors;
  return (
    <Pressable
      role="button"
      aria-label={accessibilityLabel}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => ({
        width: 40,
        height: minTouchTarget,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radii.md,
        backgroundColor: pressed ? c.surfaceMuted : 'transparent',
        opacity: disabled ? 0.45 : 1,
      })}
    >
      <Icon
        name={icon}
        size={strong ? 16 : 17}
        weight={strong ? 'bold' : 'regular'}
        color={strong ? c.text : c.textSecondary}
      />
    </Pressable>
  );
}
