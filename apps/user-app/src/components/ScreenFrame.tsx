import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Header, Icon, Text, screenGutter, spacing, useTheme } from '@qc/ui';
import { useI18n } from '../i18n/I18nProvider';
import { useOffline } from '../providers/hooks';
import { useInsets } from '../providers/insets';

export interface ScreenFrameProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  actions?: ReactNode;
  /** `large` is for the top of a tab. */
  variant?: 'regular' | 'large';
  children: ReactNode;
  /** Content kept below the scrolling area, for the main action of a form. */
  footer?: ReactNode;
  /** False when the content scrolls by itself (a long list such as the Quran reader). */
  scroll?: boolean;
  testID?: string;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: screenGutter, gap: spacing.lg },
  footer: { padding: screenGutter, borderTopWidth: 1 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: screenGutter,
    paddingVertical: spacing.sm,
  },
});

/** The frame of every screen: header, an offline note when the server cannot be reached, scrolling body. */
export function ScreenFrame({
  title,
  subtitle,
  onBack,
  actions,
  variant = 'regular',
  children,
  footer,
  scroll = true,
  testID,
}: ScreenFrameProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const offline = useOffline();
  const insets = useInsets();
  const c = theme.colors;
  return (
    <View
      testID={testID}
      style={[styles.root, { backgroundColor: c.background, paddingTop: insets.top }]}
    >
      <Header
        title={title}
        {...(subtitle ? { subtitle } : {})}
        {...(onBack ? { onBack } : {})}
        {...(actions ? { actions } : {})}
        variant={variant}
      />
      {offline ? (
        <View
          testID="offline-banner"
          role="status"
          style={[styles.banner, { backgroundColor: c.warningSubtle }]}
        >
          <Icon name="warning" size={20} color={c.textOnWarningSubtle} />
          <Text variant="caption" color="textOnWarningSubtle">
            {t('ui.offlineTitle')}
          </Text>
        </View>
      ) : null}
      {scroll ? (
        <ScrollView
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
