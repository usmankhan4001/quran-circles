import { StyleSheet, View } from 'react-native';
import { formatNumber } from '../numerals';
import { useTheme, type Theme } from '../theme';
import { radii, spacing } from '../tokens';
import { Text } from './Text';

export interface BadgeProps {
  /** An unread count. Counts above `max` show as "99+". Zero shows nothing. */
  count?: number;
  /** A plain unread dot, for "something new" without a number. */
  dot?: boolean;
  max?: number;
  /**
   * Set when the parent already announces the badge (a tab whose label includes the count),
   * so a screen reader does not read it twice.
   */
  decorative?: boolean;
  testID?: string;
}

const DOT = 10;

const styles = StyleSheet.create({
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2 },
  count: {
    minWidth: 22,
    minHeight: 22,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.xs + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

/** The words a screen reader says for a badge. Use it in the parent's label when `decorative`. */
export function badgeLabel(
  theme: Theme,
  { count, dot }: Pick<BadgeProps, 'count' | 'dot'>,
): string | undefined {
  if (count !== undefined && count > 0) {
    return theme.t('ui.unread', { count: formatNumber(count, theme.locale) });
  }
  return dot ? theme.t('ui.newUpdates') : undefined;
}

export function Badge({ count, dot, max = 99, decorative, testID }: BadgeProps) {
  const theme = useTheme();
  const label = badgeLabel(theme, { count, dot });
  if (!label) return null;
  const a11y = decorative
    ? { 'aria-hidden': true as const }
    : { role: 'img' as const, 'aria-label': label };
  if (count === undefined || count <= 0) {
    return (
      <View
        testID={testID ?? 'badge-dot'}
        {...a11y}
        style={[styles.dot, { backgroundColor: theme.colors.danger }]}
      />
    );
  }
  const shown =
    count > max ? `${formatNumber(max, theme.locale)}+` : formatNumber(count, theme.locale);
  return (
    <View
      testID={testID ?? 'badge-count'}
      {...a11y}
      style={[styles.count, { backgroundColor: theme.colors.danger }]}
    >
      <Text
        variant="caption"
        color="textOnDanger"
        lang="en"
        direction="ltr"
        align="center"
        decorative
        strong
      >
        {shown}
      </Text>
    </View>
  );
}
