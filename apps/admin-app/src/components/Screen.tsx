import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { screenGutter, spacing, useTheme } from '@qc/ui';
import { HeroHeader } from './HeroHeader';

export interface ScreenProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backLabel?: string;
  actions?: ReactNode;
  /** Kept so existing callers still compile; every screen now has the same green header. */
  variant?: 'regular' | 'large';
  /** Extra content inside the green header, under the title. */
  hero?: ReactNode;
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
  hero,
  children,
  footer,
  testID,
}: ScreenProps) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={[styles.fill, { backgroundColor: colors.background }]}>
      <HeroHeader
        title={title}
        subtitle={subtitle}
        onBack={onBack}
        backLabel={backLabel}
        actions={actions}
      >
        {hero}
      </HeroHeader>
      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
      {footer ? (
        <View
          style={[
            styles.footer,
            { borderTopColor: colors.border, backgroundColor: colors.surface },
          ]}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}
