import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';
import { spacing } from '../tokens';
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
  // Design system: a flat white bar with a hairline on top. Every tab has a word under its icon.
  // The current tab is green with a short bar above it and a bold label, so it is not colour alone.
  bar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderTopWidth: 1,
    paddingTop: 6,
    paddingBottom: spacing.sm,
  },
  tab: {
    minHeight: 56,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    paddingVertical: 6,
  },
  iconWrap: { minHeight: 28, alignItems: 'center', justifyContent: 'center' },
  marker: {
    position: 'absolute',
    top: -7,
    width: 28,
    height: 3,
    borderBottomStartRadius: 3,
    borderBottomEndRadius: 3,
  },
  label: { marginTop: 3 },
  labelRow: { flexDirection: 'row', alignItems: 'center' },
  badgeInline: { marginStart: spacing.xs },
  // On the icon's top end corner.
  badge: { position: 'absolute', top: -6, end: -12 },
});

export function TabBar({ items, activeKey, onChange, accessibilityLabel, testID }: TabBarProps) {
  const theme = useTheme();
  const c = theme.colors;
  // The bar is the app's navigation landmark (A-08), so screen-reader users can jump to it and
  // past it. The tab list inside keeps the name.
  return (
    <View role="navigation">
      <View
        testID={testID}
        role="tablist"
        aria-label={accessibilityLabel}
        style={[
          styles.bar,
          {
            backgroundColor: c.surface,
            borderColor: theme.mode === 'highContrast' ? c.borderStrong : c.hairline,
          },
        ]}
      >
        {items.map((item) => {
          const selected = item.key === activeKey;
          const color = selected ? c.accent : c.textMuted;
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
                { backgroundColor: pressed ? c.surfaceMuted : 'transparent' },
              ]}
            >
              {selected ? (
                <View
                  aria-hidden
                  testID={`tab-dot-${item.key}`}
                  style={[styles.marker, { backgroundColor: c.accent }]}
                />
              ) : null}
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
              <View style={[styles.label, item.icon ? undefined : styles.labelRow]}>
                <Text
                  variant="caption"
                  color={selected ? 'textAccent' : 'textMuted'}
                  align="center"
                  strong={selected}
                  numberOfLines={2}
                  decorative
                >
                  {item.label}
                </Text>
                {!item.icon && item.badge ? (
                  <View style={styles.badgeInline}>
                    <Badge {...item.badge} decorative />
                  </View>
                ) : null}
              </View>
            </Touchable>
          );
        })}
      </View>
    </View>
  );
}
