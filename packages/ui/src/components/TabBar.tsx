import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useTheme } from '../theme';
import { elevation, motion, radii, spacing } from '../tokens';
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

interface Slot {
  x: number;
  width: number;
}

const styles = StyleSheet.create({
  // The bar floats: a centred white pill with a hairline and a soft shadow, clear of the page edge.
  wrap: {
    alignItems: 'center',
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    gap: 2,
    borderRadius: radii.pill,
    borderWidth: 1,
    boxShadow: elevation.floating,
  },
  // The green capsule that slides to the chosen tab.
  indicator: { position: 'absolute', top: 6, bottom: 6, start: 0, borderRadius: radii.pill },
  tab: {
    minHeight: 48,
    minWidth: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    paddingHorizontal: 12,
  },
  iconWrap: { minHeight: 28, minWidth: 24, alignItems: 'center', justifyContent: 'center' },
  label: { marginStart: 8 },
  badgeInline: { marginStart: spacing.xs },
  // On the icon's top end corner.
  badge: { position: 'absolute', top: -6, end: -10 },
  // A short bar the tests and screen readers can find; the capsule is the visible mark.
  marker: { position: 'absolute', width: 1, height: 1, opacity: 0 },
});

export function TabBar({ items, activeKey, onChange, accessibilityLabel, testID }: TabBarProps) {
  const theme = useTheme();
  const c = theme.colors;
  const [slots, setSlots] = useState<Record<string, Slot>>({});
  const x = useRef(new Animated.Value(0)).current;
  const w = useRef(new Animated.Value(0)).current;
  const placed = useRef(false);
  const fade = useRef<Record<string, Animated.Value>>({});
  const fadeFor = (key: string, selected: boolean) => {
    fade.current[key] ??= new Animated.Value(selected ? 1 : 0);
    return fade.current[key]!;
  };

  const active = slots[activeKey];
  // Slide and resize the capsule to the chosen tab. The first placement and reduced motion jump.
  useEffect(() => {
    if (!active) return;
    if (!placed.current || theme.reduceMotion) {
      placed.current = true;
      x.setValue(active.x);
      w.setValue(active.width);
      return;
    }
    const config = {
      duration: motion.duration.slow,
      easing: Easing.bezier(0.2, 0, 0, 1),
      useNativeDriver: false,
    };
    Animated.parallel([
      Animated.timing(x, { toValue: active.x, ...config }),
      Animated.timing(w, { toValue: active.width, ...config }),
    ]).start();
  }, [active?.x, active?.width, theme.reduceMotion, x, w, active]);

  // The chosen tab's word fades in as the capsule grows around it.
  useEffect(() => {
    for (const item of items) {
      const value = fadeFor(item.key, item.key === activeKey);
      const to = item.key === activeKey ? 1 : 0;
      if (theme.reduceMotion) value.setValue(to);
      else
        Animated.timing(value, {
          toValue: to,
          duration: motion.duration.base,
          useNativeDriver: false,
        }).start();
    }
  }, [activeKey, items, theme.reduceMotion]);

  const onSlot = (key: string) => (e: LayoutChangeEvent) => {
    const { x: sx, width } = e.nativeEvent.layout;
    setSlots((prev) => {
      const old = prev[key];
      if (old && old.x === sx && old.width === width) return prev;
      return { ...prev, [key]: { x: sx, width } };
    });
  };

  // The bar is the app's navigation landmark (A-08), so screen-reader users can jump to it and
  // past it. The tab list inside keeps the name.
  return (
    <View role="navigation" style={styles.wrap}>
      <View
        testID={testID}
        role="tablist"
        aria-label={accessibilityLabel}
        style={[
          styles.pill,
          {
            backgroundColor: c.surface,
            borderColor: theme.mode === 'highContrast' ? c.borderStrong : c.hairline,
          },
        ]}
      >
        {active ? (
          <Animated.View
            aria-hidden
            testID="tab-indicator"
            style={[styles.indicator, { backgroundColor: c.accent, width: w, start: x }]}
          />
        ) : null}
        {items.map((item) => {
          const selected = item.key === activeKey;
          const color = selected ? c.textOnAccent : c.textMuted;
          const extra = item.badge ? badgeLabel(theme, item.badge) : undefined;
          // Without an icon the word is the tab, so it always shows.
          const showLabel = selected || !item.icon;
          return (
            <View key={item.key} onLayout={onSlot(item.key)}>
              <Touchable
                testID={item.testID ?? `tab-${item.key}`}
                role="tab"
                selected={selected}
                accessibilityLabel={extra ? `${item.label}, ${extra}` : item.label}
                onPress={() => onChange(item.key)}
                style={({ pressed }) => [
                  styles.tab,
                  { backgroundColor: pressed && !selected ? c.surfaceMuted : 'transparent' },
                ]}
              >
                {selected ? (
                  <View aria-hidden testID={`tab-dot-${item.key}`} style={styles.marker} />
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
                {showLabel ? (
                  <Animated.View
                    style={[
                      styles.label,
                      item.icon ? { opacity: fadeFor(item.key, selected) } : { marginStart: 0 },
                      { flexDirection: 'row', alignItems: 'center' },
                    ]}
                  >
                    <Text
                      variant="caption"
                      color={selected ? 'textOnAccent' : 'textMuted'}
                      align="center"
                      strong={selected}
                      numberOfLines={1}
                      decorative
                    >
                      {item.label}
                    </Text>
                    {!item.icon && item.badge ? (
                      <View style={styles.badgeInline}>
                        <Badge {...item.badge} decorative />
                      </View>
                    ) : null}
                  </Animated.View>
                ) : null}
              </Touchable>
            </View>
          );
        })}
      </View>
    </View>
  );
}
