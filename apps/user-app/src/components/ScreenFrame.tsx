import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Banner, HeroHeader, IconButton, screenGutter, spacing, useTheme } from '@qc/ui';
import { useI18n } from '../i18n/I18nProvider';
import { useOffline } from '../providers/hooks';
import { useInsets } from '../providers/insets';

export interface ScreenFrameProps {
  title: string;
  /** A short line above the title, such as the Hijri date on Home. */
  eyebrow?: string;
  subtitle?: string;
  onBack?: () => void;
  actions?: ReactNode;
  /** What sits inside the green header under the title (a lead card, a search, a switch). */
  hero?: ReactNode;
  /**
   * The screen is a sheet over another page (D13, R2): the green top has a handle and a close
   * button instead of a back arrow, and the body is raised.
   */
  sheet?: boolean;
  children: ReactNode;
  /** Content kept below the scrolling area, for the main action of a form. */
  footer?: ReactNode;
  /** False when the content scrolls by itself (a long list such as the Quran reader). */
  scroll?: boolean;
  /** Leaves out the page gutter, for content that runs edge to edge. */
  flush?: boolean;
  testID?: string;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: screenGutter, gap: spacing.lg, paddingBottom: spacing.huge },
  flush: { gap: spacing.lg, paddingBottom: spacing.huge },
  footer: { padding: screenGutter, borderTopWidth: 1 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginTop: spacing.sm },
});

/**
 * The frame of every screen: the green header (B), an offline note when the server cannot be
 * reached, scrolling body, and an optional bar for the main action.
 */
export function ScreenFrame({
  title,
  eyebrow,
  subtitle,
  onBack,
  actions,
  hero,
  sheet,
  children,
  footer,
  scroll = true,
  flush,
  testID,
}: ScreenFrameProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const offline = useOffline();
  const insets = useInsets();
  const c = theme.colors;
  const close =
    sheet && onBack ? (
      <IconButton
        icon="close"
        variant="onHero"
        accessibilityLabel={t('ui.close')}
        onPress={onBack}
        testID="sheet-close"
      />
    ) : null;
  return (
    <View testID={testID} style={[styles.root, { backgroundColor: c.background }]}>
      {/* The status bar area is green too, so the header reaches the top edge. */}
      <View style={{ backgroundColor: c.hero, paddingTop: insets.top }}>
        {sheet ? (
          <View style={[styles.handle, { backgroundColor: c.heroGlassPressed }]} aria-hidden />
        ) : null}
      </View>
      <HeroHeader
        testID="screen-header"
        title={title}
        {...(eyebrow ? { eyebrow } : {})}
        {...(subtitle ? { subtitle } : {})}
        {...(onBack && !sheet ? { onBack } : {})}
        {...(close ? { actions: close } : actions ? { actions } : {})}
      >
        {hero}
      </HeroHeader>
      {offline ? (
        <Banner kind="offline" title={t('ui.offlineTitle')} testID="offline-banner" />
      ) : null}
      {scroll ? (
        <ScrollView
          style={styles.root}
          contentContainerStyle={flush ? styles.flush : styles.body}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={styles.root}>{children}</View>
      )}
      {footer ? (
        <View
          style={[
            styles.footer,
            {
              borderTopColor: c.border,
              backgroundColor: c.surface,
              paddingBottom: screenGutter + insets.bottom,
            },
          ]}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}
