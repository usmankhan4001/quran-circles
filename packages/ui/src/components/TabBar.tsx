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

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'stretch', borderTopWidth: 1 },
  tab: {
    flex: 1,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderTopWidth: 4,
  },
  iconWrap: { minHeight: 28, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -4, start: '55%' },
});

export function TabBar({ items, activeKey, onChange, accessibilityLabel, testID }: TabBarProps) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <View
      testID={testID}
      role="tablist"
      aria-label={accessibilityLabel}
      style={[styles.bar, { backgroundColor: c.surface, borderTopColor: c.border }]}
    >
      {items.map((item) => {
        const selected = item.key === activeKey;
        const color = selected ? c.textAccent : c.textSecondary;
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
              {
                borderTopColor: selected ? c.accent : 'transparent',
                backgroundColor: selected
                  ? c.accentSubtle
                  : pressed
                    ? c.surfaceMuted
                    : 'transparent',
              },
            ]}
          >
            <View style={styles.iconWrap}>
              {typeof item.icon === 'function' ? item.icon({ selected, color }) : item.icon}
              {item.badge ? (
                <View style={styles.badge}>
                  <Badge {...item.badge} decorative />
                </View>
              ) : null}
            </View>
            <Text
              variant="caption"
              color={selected ? 'textAccent' : 'textSecondary'}
              align="center"
              strong={selected}
              numberOfLines={2}
              decorative
            >
              {item.label}
            </Text>
          </Touchable>
        );
      })}
    </View>
  );
}
