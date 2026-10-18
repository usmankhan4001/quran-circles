import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { HeroHeader, screenGutter, spacing, useTheme } from '@qc/ui';

export interface ScreenProps {
  title: string;
  subtitle?: string;
  /** A short line above the title, inside the green header. */
  eyebrow?: string;
  onBack?: () => void;
  backLabel?: string;
  /** `IconButton`s with `variant="onHero"`, or a `Tag`, at the end of the header's top row. */
  actions?: ReactNode;
  /** Extra content inside the green header, under the title. */
  hero?: ReactNode;
  children: ReactNode;
  /** Pinned under the content, for the one main action of a form. See also `ScreenFooter`. */
  footer?: ReactNode;
  testID?: string;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: screenGutter, gap: spacing.lg, paddingBottom: spacing.xxl },
  footer: { padding: screenGutter, gap: spacing.sm },
});

/** Lets a form deep inside a screen put its main action in the pinned bar at the bottom. */
const FooterSlot = createContext<((node: ReactNode) => void) | null>(null);

/**
 * Puts its children in the pinned bar of the nearest `Screen`. Outside a screen it renders them
 * in place, so a form still works on its own.
 */
export function ScreenFooter({ children }: { children: ReactNode }) {
  const setFooter = useContext(FooterSlot);
  // No dependency list on purpose: the bar follows every render of the form that owns it.
  useLayoutEffect(() => {
    setFooter?.(children);
  });
  useLayoutEffect(() => () => setFooter?.(null), [setFooter]);
  return setFooter ? null : <View style={styles.footer}>{children}</View>;
}

/**
 * The frame of every screen (layout A): the kit's green header, a scrolling body with the
 * standard gutter, and a pinned bar for the main action.
 */
export function Screen({
  title,
  subtitle,
  eyebrow,
  onBack,
  backLabel,
  actions,
  hero,
  children,
  footer,
  testID,
}: ScreenProps) {
  const { colors, mode } = useTheme();
  const [slotted, setSlotted] = useState<ReactNode>(null);
  const bar = footer ?? slotted;
  // The screen is the page's `main` landmark (A-08), with the green header inside it: a `banner`
  // may not sit inside `main`, and the kit's in-screen header has no banner role. The bottom
  // menu is the `navigation` landmark (the kit's TabBar).
  return (
    <View testID={testID} role="main" style={[styles.fill, { backgroundColor: colors.background }]}>
      <HeroHeader
        testID={testID ? `${testID}-hero` : undefined}
        title={title}
        subtitle={subtitle}
        eyebrow={eyebrow}
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
        <FooterSlot.Provider value={setSlotted}>{children}</FooterSlot.Provider>
      </ScrollView>
      {bar ? (
        <View
          testID="screen-footer"
          style={[
            styles.footer,
            {
              backgroundColor: colors.surface,
              borderTopWidth: mode === 'light' ? 0 : 1,
              borderTopColor: colors.border,
            },
          ]}
        >
          {bar}
        </View>
      ) : null}
    </View>
  );
}
