import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';
import { elevation, radii, spacing } from '../tokens';
import { Badge, badgeLabel, type BadgeProps } from './Badge';
import { Text } from './Text';
import { Touchable } from './Touchable';

export interface TabItem {
  key: string;
  label: string;
  /** The icon, or a function that draws it for the selected and unselected state. */
  icon?: ReactNode | ((state: { selected: boolean; color: string }) => ReactNode);
  badge?: Pick<BadgeProps, 'count' | 'dot'>;
  testID?: string;
}

export interface TabBarProps {
  items: readonly TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  /** The name of the group for a screen reader, for example "Main menu". */
  accessibilityLabel?: string;
  testID?: string;
}

// The chosen tab takes the width its label needs, so the label is not cut; the others share
// what is left.
const chosen = { flexGrow: 0, flexShrink: 0, paddingHorizontal: spacing.lg } as const;
const other = { flexGrow: 1, flexShrink: 1, flexBasis: 0 } as const;

const styles = StyleSheet.create({
  // D12: a floating bar. The chosen tab is a green pill with its label; the others show the
  // icon, and every tab keeps its name for screen readers.
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  tab: {
    flexDirection: 'row',
    minHeight: 52,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
  },
  label: { marginStart: spacing.xs + 2, flexShrink: 1 },
  // The badge reaches past the icon's end by 12, and grows with the text size; the label of the
  // chosen tab starts clear of it, so the count never covers the label (A-10).
  labelAfterBadge: { marginStart: 12 + spacing.xs },
  iconWrap: { minHeight: 28, alignItems: 'center', justifyContent: 'center' },
  // On the icon's top end corner, clear of the label.
  badge: { position: 'absolute', top: -6, end: -12 },
  badgeInline: { marginStart: spacing.xs },
});

export function TabBar({ items, activeKey, onChange, accessibilityLabel, testID }: TabBarProps) {
  const theme = useTheme();
  const c = theme.colors;
  // The bar is the app's navigation landmark (A-08), so screen-reader users can jump to it and
  // past it. It is the only one on a screen, so it needs no name of its own; the tab list inside
  // keeps the name.
  return (
    <View role="navigation">
      <View
        testID={testID}
        role="tablist"
        aria-label={accessibilityLabel}
        style={[
          styles.bar,
          {
            backgroundColor: c.surfaceRaised,
            borderColor: theme.mode === 'highContrast' ? c.borderStrong : c.border,
            boxShadow: theme.mode === 'light' ? elevation.high : undefined,
          },
        ]}
      >
        {items.map((item) => {
          const selected = item.key === activeKey;
          const color = selected ? c.textOnAccent : c.textSecondary;
          const extra = item.badge ? badgeLabel(theme, item.badge) : undefined;
          return (
            <Touchable
              key={item.key}
              testID={item.testID ?? `tab-${item.key}`}
              role="tab"
              selected={selected}
              accessibilityLabel={extra ? `${item.label}, ${extra}` : item.label}
              onPress={() => onChange(item.key)}
              style={({ pressed }) => [
                styles.tab,
                selected ? chosen : other,
                {
                  backgroundColor: selected ? c.accent : pressed ? c.surfaceMuted : 'transparent',
                  boxShadow: selected && theme.mode === 'light' ? elevation.medium : undefined,
                },
              ]}
            >
              {item.icon ? (
                <View style={styles.iconWrap}>
                  {typeof item.icon === 'function' ? item.icon({ selected, color }) : item.icon}
                  {item.badge ? (
                    <View style={styles.badge}>
                      <Badge {...item.badge} decorative />
                    </View>
                  ) : null}
                </View>
              ) : null}
              {/* Without an icon the label is the only thing to see, so it always shows. */}
              {selected || !item.icon ? (
                <Text
                  variant="caption"
                  color={selected ? 'textOnAccent' : 'textSecondary'}
                  align="center"
                  strong={selected}
                  numberOfLines={1}
                  decorative
                  style={[styles.label, item.badge && item.icon ? styles.labelAfterBadge : null]}
                >
                  {item.label}
                </Text>
              ) : null}
              {item.badge && !item.icon ? (
                <View style={styles.badgeInline}>
                  <Badge {...item.badge} decorative />
                </View>
              ) : null}
            </Touchable>
          );
        })}
      </View>
    </View>
  );
}
