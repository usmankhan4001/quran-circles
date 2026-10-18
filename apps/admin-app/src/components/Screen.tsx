import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { HeroHeader, IconButton, Text, screenGutter, spacing, useTheme } from '@qc/ui';

export interface ScreenProps {
  /** The screen title. A hero screen may leave it out when its content carries the heading. */
  title?: string;
  subtitle?: string;
  /** A short line above the title, inside the green header. */
  eyebrow?: string;
  onBack?: () => void;
  backLabel?: string;
  /** `IconButton`s with `variant="onHero"`, or a `Tag`, at the end of the header's top row. */
  actions?: ReactNode;
  /** At the start of the green header's top row, such as the scope pill (D17). */
  leading?: ReactNode;
  /**
   * `hero` (tabs): the green header that fades into the page. `plain` (D17, every screen with a
   * back button): a white bar with the back button, the title centred and `actions` at the end.
   * Defaults to `plain` when there is a back button.
   */
  variant?: 'hero' | 'plain';
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
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
  },
  side: { flexGrow: 1, flexBasis: 0, minWidth: 48, flexDirection: 'row', alignItems: 'center' },
  end: { justifyContent: 'flex-end' },
  titles: { flexShrink: 1, alignItems: 'center', paddingHorizontal: spacing.xs },
});

/** D17: the white bar of a screen opened from another: back, the title centred, a status at the end. */
function PlainHeader({
  title,
  subtitle,
  onBack,
  backLabel,
  actions,
  testID,
}: Pick<ScreenProps, 'title' | 'subtitle' | 'onBack' | 'backLabel' | 'actions' | 'testID'>) {
  const { colors, t } = useTheme();
  return (
    <View testID={testID} style={[styles.bar, { backgroundColor: colors.background }]}>
      <View style={styles.side}>
        {onBack ? (
          <IconButton
            icon="chevron-back"
            accessibilityLabel={backLabel ?? t('ui.back')}
            onPress={onBack}
          />
        ) : null}
      </View>
      <View style={styles.titles}>
        {title ? (
          <Text variant="body" strong heading={1} align="center" numberOfLines={2}>
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text variant="caption" color="textSecondary" align="center" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={[styles.side, styles.end]}>{actions}</View>
    </View>
  );
}

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
 * The frame of every screen: the kit's green header on the tabs (or the white bar with a back
 * button on the screens opened from them, D17), a scrolling body with the standard gutter, and a
 * pinned bar for the main action.
 */
export function Screen({
  title,
  subtitle,
  eyebrow,
  onBack,
  backLabel,
  actions,
  leading,
  variant,
  hero,
  children,
  footer,
  testID,
}: ScreenProps) {
  const plain = (variant ?? (onBack ? 'plain' : 'hero')) === 'plain';
  const { colors, mode } = useTheme();
  const [slotted, setSlotted] = useState<ReactNode>(null);
  const bar = footer ?? slotted;
  // The screen is the page's `main` landmark (A-08), with the green header inside it: a `banner`
  // may not sit inside `main`, and the kit's in-screen header has no banner role. The bottom
  // menu is the `navigation` landmark (the kit's TabBar).
  return (
    <View testID={testID} role="main" style={[styles.fill, { backgroundColor: colors.background }]}>
      {plain ? (
        <PlainHeader
          testID={testID ? `${testID}-hero` : undefined}
          title={title}
          subtitle={subtitle}
          onBack={onBack}
          backLabel={backLabel}
          actions={actions}
        />
      ) : (
        <HeroHeader
          testID={testID ? `${testID}-hero` : undefined}
          title={title}
          subtitle={subtitle}
          eyebrow={eyebrow}
          onBack={onBack}
          backLabel={backLabel}
          actions={actions}
          leading={leading}
        >
          {hero}
        </HeroHeader>
      )}
      {plain && hero ? <View style={{ paddingHorizontal: screenGutter }}>{hero}</View> : null}
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
