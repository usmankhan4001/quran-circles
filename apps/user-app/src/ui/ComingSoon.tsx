import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text, minTouchTarget, radii, spacing, useTheme } from '@qc/ui';
import { useI18n } from '../i18n/I18nProvider';

/** How much a drawn placeholder is faded. High contrast keeps more of it, so it stays legible. */
export const COMING_SOON_OPACITY = 0.5;
export const COMING_SOON_OPACITY_HIGH_CONTRAST = 0.75;

export interface ComingSoonProps {
  /**
   * The words drawn for the feature ("Join online"). Screen readers say it followed by
   * "coming soon", so the spoken name always holds the visible one.
   */
  label: string;
  /**
   * What is drawn for the feature, faded. Pass only text, icons and pictures: nothing in it may
   * be pressable. Leave it out for an action: a greyed button face with the label is drawn.
   */
  children?: ReactNode;
  /**
   * What the feature would be: `button` (the default without children) or `link` for an action
   * that is not built yet, `group` (the default with children) for content.
   */
  role?: 'button' | 'link' | 'group';
  /** False when the layout places a `ComingSoonBadge` itself (on a picture, say). */
  badge?: boolean;
  /**
   * The drawn part takes the free width, with the badge at the end of the row. Give the whole
   * thing its width with `style` (`alignSelf: 'stretch'` or `flex: 1`).
   */
  grow?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
  grow: { flex: 1 },
  shrink: { flexShrink: 1 },
  badge: {
    alignSelf: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  face: {
    minHeight: minTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },
});

/** The small "Coming soon" pill. Decoration: the feature it sits on says the words itself. */
export function ComingSoonBadge({ testID }: { testID?: string }) {
  const { t } = useI18n();
  const theme = useTheme();
  const c = theme.colors;
  return (
    <View
      aria-hidden
      testID={testID ?? 'coming-soon-badge'}
      style={[
        styles.badge,
        {
          backgroundColor: c.surface,
          borderColor: theme.mode === 'highContrast' ? c.borderStrong : c.border,
        },
      ]}
    >
      <Text variant="caption" color="textSecondary" strong decorative>
        {t('comingSoon.badge')}
      </Text>
    </View>
  );
}

/**
 * The one look for a feature that is drawn but has no data or code behind it yet (owner's
 * decision, 25 Oct 2026): it stays on the screen, faded, with a small "Coming soon" badge. It
 * cannot be pressed, and screen readers hear its name, "coming soon" and that it is turned off
 * (`aria-disabled`), as one stop.
 */
export function ComingSoon({
  label,
  children,
  role,
  badge = true,
  grow = false,
  style,
  testID,
}: ComingSoonProps) {
  const { t } = useI18n();
  const theme = useTheme();
  const c = theme.colors;
  const faded =
    theme.mode === 'highContrast' ? COMING_SOON_OPACITY_HIGH_CONTRAST : COMING_SOON_OPACITY;
  const drawn =
    children === undefined ? (
      <View style={[styles.face, { backgroundColor: c.disabledBackground }]}>
        <Text variant="label" color="disabledText" decorative>
          {label}
        </Text>
      </View>
    ) : (
      children
    );
  return (
    <View
      accessible
      role={role ?? (children === undefined ? 'button' : 'group')}
      aria-label={t('comingSoon.label', { feature: label })}
      aria-disabled
      testID={testID}
      style={[styles.row, style]}
    >
      <View
        aria-hidden
        pointerEvents="none"
        style={[
          grow ? styles.grow : styles.shrink,
          children === undefined ? null : { opacity: faded },
        ]}
      >
        {drawn}
      </View>
      {badge ? <ComingSoonBadge /> : null}
    </View>
  );
}
