import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Banner, spacing, useTheme } from '@qc/ui';
import { useI18n } from '../i18n/I18nProvider';
import { useOffline } from '../providers/hooks';
import { useInsets } from '../providers/insets';

export interface TabFrameProps {
  /**
   * The top of the tab: the green `HeroHeader` with the area picker on Home, or the white title
   * row with the List / Map switch on Nearby (D17). It scrolls away with the page.
   */
  header: ReactNode;
  /** True when the header is the green one, so the status bar area is green too. */
  green?: boolean;
  children: ReactNode;
  testID?: string;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { paddingBottom: spacing.huge + spacing.xxl },
});

/**
 * The frame of the Home and Nearby tabs (D17). Unlike `ScreenFrame` the drawings give these two
 * no big green title: Home leads with the area picker and the next circle, Nearby with a white
 * "Nearby Circles" row. It keeps what every page needs: the `main` landmark (A-08), the offline
 * note and the safe area at the top. The screens lay out their own gutters (20 dp, as drawn),
 * since rows such as Home's pictures run to the edge of the screen.
 */
export function TabFrame({ header, green, children, testID }: TabFrameProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const offline = useOffline();
  const insets = useInsets();
  const c = theme.colors;
  return (
    <View testID={testID} role="main" style={[styles.root, { backgroundColor: c.background }]}>
      <View style={{ backgroundColor: green ? c.hero : c.background, paddingTop: insets.top }} />
      <ScrollView
        testID="screen-scroll"
        style={styles.root}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {header}
        {offline ? (
          <Banner kind="offline" title={t('ui.offlineTitle')} testID="offline-banner" />
        ) : null}
        {children}
      </ScrollView>
    </View>
  );
}
