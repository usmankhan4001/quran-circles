import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Header, screenGutter, spacing, useTheme } from '@qc/ui';

export interface ScreenProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backLabel?: string;
  actions?: ReactNode;
  /** The tab roots use the large title. */
  variant?: 'regular' | 'large';
  children: ReactNode;
  /** Pinned under the content, for the one main action of a form. */
  footer?: ReactNode;
  testID?: string;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: screenGutter, gap: spacing.lg, paddingBottom: spacing.xxl },
  footer: { padding: screenGutter, borderTopWidth: 1, gap: spacing.sm },
});

/** The frame of every screen: the kit's header, a scrolling body with the standard gutter. */
export function Screen({
  title,
  subtitle,
  onBack,
  backLabel,
  actions,
  variant = 'regular',
  children,
  footer,
  testID,
}: ScreenProps) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={[styles.fill, { backgroundColor: colors.background }]}>
      <Header
        title={title}
        subtitle={subtitle}
        onBack={onBack}
        backLabel={backLabel}
        actions={actions}
        variant={variant}
      />
      <ScrollView style={styles.fill} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
      {footer ? (
        <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
          {footer}
        </View>
      ) : null}
    </View>
  );
}
