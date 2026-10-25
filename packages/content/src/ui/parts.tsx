import type { ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  Button,
  Icon,
  Text,
  formatNumber,
  minTouchTarget,
  radii,
  spacing,
  useTheme,
  type IconName,
} from '@qc/ui';

// Small pieces the Quran and prayer screens share, drawn from the Quran Circles design system:
// mostly white, hairline edges, one green accent, no shadows.

/** A white card with a hairline edge, flat. `outlined` is the chosen look (a green edge). */
export function WhiteCard({
  children,
  radius = radii.card,
  padding = 16,
  outlined,
  style,
  testID,
}: {
  children: ReactNode;
  radius?: number;
  padding?: number;
  /** A green edge: the current prayer, the ayah asked for. */
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
          borderWidth: outlined ? 2 : 1,
          borderColor: outlined ? c.accent : hc ? c.borderStrong : c.hairline,
          padding,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** The green dot and short line that opens a lead card. */
export function StatusLine({ label, testID }: { label: string; testID?: string }) {
  const c = useTheme().colors;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 }}>
      <View
        aria-hidden
        style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.accent }}
      />
      <Text variant="eyebrow" color="textAccent" testID={testID}>
        {label}
      </Text>
    </View>
  );
}

/** A quiet action with a forward arrow, kept under the old name for the app's cards. */
export function PillCta({
  label,
  onPress,
  accessibilityLabel,
  testID,
}: {
  label: string;
  onPress: () => void;
  /** Kept for callers written for the earlier look; the kit's button sets its own height. */
  height?: number;
  small?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}) {
  return (
    <Button
      variant="secondary"
      label={label}
      trailingIcon="arrow-forward"
      onPress={onPress}
      {...(accessibilityLabel ? { accessibilityLabel } : {})}
      {...(testID ? { testID } : {})}
    />
  );
}

/** A section title with an optional quiet link at the end. */
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
        minHeight: 44,
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
          <Text variant="caption" color="textAccent">
            {more}
          </Text>
          <Icon name="caret-right" weight="bold" size={11} color={c.textAccent} />
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * The tabs of the Quran list (Surahs, Juz, Saved): plain words on a hairline, the chosen one in
 * dark text with a green line under it.
 */
export function UnderlineTabs<T extends string>({
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
  const c = useTheme().colors;
  return (
    <View
      role="tablist"
      aria-label={accessibilityLabel}
      testID={testID}
      style={{
        flexDirection: 'row',
        gap: spacing.lg + spacing.xs,
        borderBottomWidth: 1,
        borderBottomColor: c.hairline,
      }}
    >
      {options.map((option) => {
        const chosen = option.value === value;
        return (
          <Pressable
            key={option.value}
            role="tab"
            aria-selected={chosen}
            onPress={() => onChange(option.value)}
            testID={testID ? `${testID}-${option.value}` : undefined}
            style={{
              minHeight: 44,
              justifyContent: 'center',
              borderBottomWidth: 2,
              marginBottom: -1,
              borderBottomColor: chosen ? c.accent : 'transparent',
            }}
          >
            <Text variant="label" strong={chosen} color={chosen ? 'text' : 'textMuted'}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * The ayah number in a thin ring (the surah list's number, the juz number). Western digits in
 * both languages. It grows with the text size.
 */
export function NumberRing({
  value,
  accessibilityLabel,
  testID,
}: {
  value: number;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const theme = useTheme();
  const size = Math.round(32 * theme.scale);
  return (
    <View
      testID={testID}
      role={accessibilityLabel ? 'img' : undefined}
      aria-label={accessibilityLabel}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1,
        borderColor: theme.colors.borderStrong,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        variant="caption"
        color="textMuted"
        lang="en"
        direction="ltr"
        align="center"
        decorative={Boolean(accessibilityLabel)}
      >
        {formatNumber(value, 'en')}
      </Text>
    </View>
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

/** A small icon button of a top bar, with a 48 dp touch area. */
export function BarIcon({
  icon,
  accessibilityLabel,
  onPress,
  disabled,
  testID,
}: {
  icon: IconName;
  accessibilityLabel: string;
  onPress?: () => void;
  disabled?: boolean;
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
        width: minTouchTarget,
        height: minTouchTarget,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radii.control,
        backgroundColor: pressed ? c.surfaceMuted : 'transparent',
        opacity: disabled ? 0.45 : 1,
      })}
    >
      <Icon name={icon} size={22} color={c.text} />
    </Pressable>
  );
}
