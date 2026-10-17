import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { IconButton, Text, minTouchTarget, radii, spacing, useTheme } from '@qc/ui';
import { useT } from '../appearance/AppearanceProvider';

export interface HeroHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backLabel?: string;
  /** Buttons at the end of the bar, usually `IconButton variant="onHero"`. */
  actions?: ReactNode;
  /** Extra content under the title inside the green area, such as a stat row. */
  children?: ReactNode;
  testID?: string;
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    borderBottomStartRadius: radii.sheet,
    borderBottomEndRadius: radii.sheet,
  },
  bar: { flexDirection: 'row', alignItems: 'center', minHeight: minTouchTarget },
  titles: { flex: 1, paddingHorizontal: spacing.xs },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  extra: { marginTop: spacing.md },
});

/**
 * The green header of every screen (layout A). It paints only `hero`, `textOnHero` and the glass
 * button tokens, so it follows light, dark and high contrast.
 * TODO(kit): replace with @qc/ui Header green variant when the kit exports it.
 */
export function HeroHeader({
  title,
  subtitle,
  onBack,
  backLabel,
  actions,
  children,
  testID,
}: HeroHeaderProps) {
  const { colors } = useTheme();
  const { t } = useT();
  return (
    <View testID={testID} style={[styles.hero, { backgroundColor: colors.hero }]}>
      <View style={styles.bar}>
        {onBack ? (
          <IconButton
            icon="chevron-back"
            variant="onHero"
            accessibilityLabel={backLabel ?? t('ui.back')}
            onPress={onBack}
            testID="hero-back"
          />
        ) : null}
        <View style={styles.titles}>
          <Text variant="title2" heading={1} color="textOnHero" numberOfLines={2}>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="caption" color="textOnHero" numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {actions ? <View style={styles.actions}>{actions}</View> : null}
      </View>
      {children ? <View style={styles.extra}>{children}</View> : null}
    </View>
  );
}
