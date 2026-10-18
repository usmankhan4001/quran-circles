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

// Every tab shares the width equally (inline, so the share is plain to see and test).
const share = { flexGrow: 1, flexShrink: 1, flexBasis: 0 } as const;

const styles = StyleSheet.create({
  // D17: a white floating dock of icons. The chosen icon turns charcoal and gains a dot under it
  // (so the choice is not shown by colour alone); every tab keeps its name for screen readers.
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.xl + spacing.sm,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  tab: {
    minHeight: 52,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  textTab: { paddingHorizontal: spacing.sm },
  iconWrap: { minHeight: 28, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 4, height: 4, borderRadius: 2, marginTop: 4 },
  dotSpace: { height: 4, marginTop: 4 },
  // On the icon's top end corner.
  badge: { position: 'absolute', top: -6, end: -12 },
  badgeInline: { marginStart: spacing.xs },
  textRow: { flexDirection: 'row', alignItems: 'center' },
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
            borderColor: theme.mode === 'highContrast' ? c.borderStrong : c.hairline,
            boxShadow: theme.mode === 'light' ? elevation.high : undefined,
          },
        ]}
      >
        {items.map((item) => {
          const selected = item.key === activeKey;
          const color = selected ? c.text : c.textMuted;
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
                share,
                item.icon ? null : styles.textTab,
                { backgroundColor: pressed ? c.surfaceMuted : 'transparent' },
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
              ) : (
                // Without an icon the label is the only thing to see, so it shows.
                <View style={styles.textRow}>
                  <Text
                    variant="caption"
                    color={selected ? 'text' : 'textMuted'}
                    align="center"
                    strong={selected}
                    numberOfLines={1}
                    decorative
                  >
                    {item.label}
                  </Text>
                  {item.badge ? (
                    <View style={styles.badgeInline}>
                      <Badge {...item.badge} decorative />
                    </View>
                  ) : null}
                </View>
              )}
              {selected ? (
                <View
                  aria-hidden
                  testID={`tab-dot-${item.key}`}
                  style={[styles.dot, { backgroundColor: c.text }]}
                />
              ) : (
                <View aria-hidden style={styles.dotSpace} />
              )}
            </Touchable>
          );
        })}
      </View>
    </View>
  );
}
