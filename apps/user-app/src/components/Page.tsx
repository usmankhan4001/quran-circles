import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Banner, IconButton, Text, screenGutter, spacing, useTheme } from '@qc/ui';
import { useI18n } from '../i18n/I18nProvider';
import { useOffline } from '../providers/hooks';
import { useInsets } from '../providers/insets';

export interface PageProps {
  /** Small title in the top bar (a step, a screen name). The big title belongs in the content. */
  barTitle?: string;
  onBack?: () => void;
  /** Controls at the far end of the top bar, such as Share or "Not now". */
  trailing?: ReactNode;
  children: ReactNode;
  /** The main action, kept at the bottom of the screen. */
  footer?: ReactNode;
  /** False when the content scrolls by itself (a long list such as the Quran reader). */
  scroll?: boolean;
  /** Keeps the content from stretching to fill the height; the footer follows it directly. */
  testID?: string;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: spacing.sm,
  },
  barTitle: { flex: 1, paddingHorizontal: spacing.xs },
  spacer: { flex: 1 },
  body: {
    flexGrow: 1,
    paddingHorizontal: screenGutter,
    paddingBottom: spacing.xl,
    gap: spacing.xl,
  },
  footer: { paddingHorizontal: screenGutter, paddingTop: spacing.md, gap: spacing.md },
});

/**
 * The frame of every page that is not a tab: a plain top bar on the white page (back button, a
 * small title, controls), the offline note, the scrolling content and the main action at the
 * bottom. There is no coloured band. A page is the `main` landmark (A-08).
 */
export function Page({
  barTitle,
  onBack,
  trailing,
  children,
  footer,
  scroll = true,
  testID,
}: PageProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const offline = useOffline();
  const insets = useInsets();
  const c = theme.colors;
  return (
    <View
      testID={testID}
      role="main"
      style={[styles.root, { backgroundColor: c.background, paddingTop: insets.top }]}
    >
      {onBack || barTitle || trailing ? (
        <View style={styles.bar} testID="screen-header">
          {onBack ? (
            <IconButton
              icon="chevron-back"
              accessibilityLabel={t('ui.back')}
              onPress={onBack}
              testID="page-back"
            />
          ) : null}
          {barTitle ? (
            <View style={styles.barTitle}>
              <Text variant="title3" numberOfLines={1}>
                {barTitle}
              </Text>
            </View>
          ) : (
            <View style={styles.spacer} />
          )}
          {trailing}
        </View>
      ) : null}
      {offline ? (
        <Banner kind="offline" title={t('states.offline.banner')} testID="offline-banner" />
      ) : null}
      {scroll ? (
        <ScrollView
          testID="screen-scroll"
          style={styles.root}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={styles.root}>{children}</View>
      )}
      {footer ? (
        <View style={[styles.footer, { paddingBottom: spacing.lg + insets.bottom }]}>{footer}</View>
      ) : null}
    </View>
  );
}
