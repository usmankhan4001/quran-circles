import { useState, type ReactNode } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewStyle,
} from 'react-native';
import {
  Banner,
  HeroHeader,
  IconButton,
  Text,
  minTouchTarget,
  screenGutter,
  spacing,
  useTheme,
} from '@qc/ui';
import { useI18n } from '../i18n/I18nProvider';
import { useOffline } from '../providers/hooks';
import { useInsets } from '../providers/insets';
import { VenueArt } from '../ui/VenueArt';

export interface ScreenPhoto {
  /** Picks the colouring of the drawn place, so each place keeps its own. */
  seed: string;
  /** Shares the page. Leave it out to show no share button. */
  onShare?: () => void;
  testID?: string;
}

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
  /**
   * The top of a place or a session (S1): a drawn picture of the place across the top with a
   * dark fade, round glass back and share buttons on it, and the title over its lower edge.
   */
  photo?: ScreenPhoto;
  children: ReactNode;
  /** Content kept below the scrolling area, for the main action of a form. */
  footer?: ReactNode;
  /** False when the content scrolls by itself (a long list such as the Quran reader). */
  scroll?: boolean;
  /** Leaves out the page gutter, for content that runs edge to edge. */
  flush?: boolean;
  testID?: string;
}

/** Height of the drawn place at the top of a session or venue (S1). */
export const PHOTO_HEIGHT = 230;
/** Until the header has been measured, the compact row shows after this much scrolling. */
const FALLBACK_HEADER_HEIGHT = 160;

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: screenGutter, gap: spacing.lg },
  flush: { gap: spacing.lg },
  scrollContent: { paddingBottom: spacing.huge },
  footer: { padding: screenGutter, borderTopWidth: 1 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginTop: spacing.sm },
  compact: {
    position: 'absolute',
    start: 0,
    end: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: minTouchTarget + spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  compactTitle: { flex: 1 },
  photoTop: {
    position: 'absolute',
    top: 0,
    start: 0,
    end: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  photoTitles: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.xs },
  photoBody: { marginTop: spacing.md },
});

/**
 * The top of a place or session page (S1): the drawn place, a dark fade at the top for the
 * glass buttons, and the title over a fade into the green. It keeps the green behind it, so the
 * title reads in `textOnHero` even before the picture is drawn.
 */
function PhotoHeader({
  photo,
  title,
  eyebrow,
  subtitle,
  onBack,
  actions,
  children,
}: {
  photo: ScreenPhoto;
  title: string;
  eyebrow?: string;
  subtitle?: string;
  onBack?: () => void;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const c = theme.colors;
  const web = Platform.OS === 'web' && theme.mode !== 'highContrast';
  const topFade: ViewStyle = web
    ? ({
        backgroundImage: `linear-gradient(180deg, ${c.scrim} 0%, transparent 100%)`,
      } as ViewStyle)
    : {};
  const titleFade: ViewStyle = web
    ? ({
        marginTop: -spacing.huge,
        paddingTop: spacing.xxl,
        backgroundImage: `linear-gradient(180deg, transparent 0%, ${c.hero} 55%)`,
      } as ViewStyle)
    : { paddingTop: spacing.lg, backgroundColor: c.hero };
  return (
    <View testID="screen-header" style={{ backgroundColor: c.hero }}>
      <VenueArt seed={photo.seed} height={PHOTO_HEIGHT} testID={photo.testID ?? 'screen-photo'}>
        <View
          aria-hidden
          pointerEvents="none"
          style={[styles.photoTop, { bottom: PHOTO_HEIGHT / 2 }, topFade]}
        />
      </VenueArt>
      <View style={styles.photoTop}>
        {onBack ? (
          <IconButton
            icon="chevron-back"
            variant="onHero"
            accessibilityLabel={t('ui.back')}
            onPress={onBack}
          />
        ) : (
          <View />
        )}
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {actions}
          {photo.onShare ? (
            <IconButton
              icon="share"
              variant="onHero"
              accessibilityLabel={t('session.share')}
              onPress={photo.onShare}
              testID="screen-share"
            />
          ) : null}
        </View>
      </View>
      <View style={[styles.photoTitles, titleFade]}>
        {eyebrow ? (
          <Text variant="caption" color="textOnHero">
            {eyebrow}
          </Text>
        ) : null}
        <Text variant="title1" color="textOnHero" heading={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="body" color="textOnHero">
            {subtitle}
          </Text>
        ) : null}
        {children ? <View style={styles.photoBody}>{children}</View> : null}
      </View>
    </View>
  );
}

/**
 * The frame of every screen: the green header (B), an offline note when the server cannot be
 * reached, scrolling body, and an optional bar for the main action.
 *
 * On a scrolling page the header scrolls away with the page, as drawn, and a compact green row
 * with the title (and the back button) stays at the top once it has gone. A sheet, and a page
 * whose content scrolls by itself, keep the header fixed.
 */
export function ScreenFrame({
  title,
  eyebrow,
  subtitle,
  onBack,
  actions,
  hero,
  sheet,
  photo,
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
  const [headerHeight, setHeaderHeight] = useState(0);
  const [compact, setCompact] = useState(false);
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

  const header = photo ? (
    <PhotoHeader
      photo={photo}
      title={title}
      {...(eyebrow ? { eyebrow } : {})}
      {...(subtitle ? { subtitle } : {})}
      {...(onBack ? { onBack } : {})}
      {...(actions ? { actions } : {})}
    >
      {hero}
    </PhotoHeader>
  ) : (
    <HeroHeader
      testID="screen-header"
      title={title}
      shape={sheet ? 'rounded' : 'fade'}
      {...(eyebrow ? { eyebrow } : {})}
      {...(subtitle ? { subtitle } : {})}
      {...(onBack && !sheet ? { onBack } : {})}
      {...(close ? { actions: close } : actions ? { actions } : {})}
    >
      {hero}
    </HeroHeader>
  );
  const banner = offline ? (
    <Banner kind="offline" title={t('ui.offlineTitle')} testID="offline-banner" />
  ) : null;
  // The header scrolls with the page, except on a sheet and when the content scrolls itself.
  const scrollsAway = scroll && !sheet;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const limit = (headerHeight || FALLBACK_HEADER_HEIGHT) - minTouchTarget;
    const next = y > Math.max(minTouchTarget, limit);
    if (next !== compact) setCompact(next);
  };

  const body = <View style={flush ? styles.flush : styles.body}>{children}</View>;

  // Landmarks (A-08): a page is the `main` landmark, so screen-reader users can jump to it and
  // past the tab bar (`navigation`, in the kit's TabBar). A sheet over another page is a named
  // modal dialog instead, so it never adds a second `main`. The green header stays inside: a
  // `banner` may not sit inside `main`, and the kit's in-screen header has no banner role
  // (docs/design/accessibility.md).
  const landmark = sheet
    ? ({ role: 'dialog', 'aria-modal': true, 'aria-label': title } as const)
    : ({ role: 'main' } as const);
  return (
    <View testID={testID} {...landmark} style={[styles.root, { backgroundColor: c.background }]}>
      {/* The status bar area is green too, so the header reaches the top edge. */}
      <View style={{ backgroundColor: c.hero, paddingTop: insets.top }}>
        {sheet ? (
          <View style={[styles.handle, { backgroundColor: c.heroGlassPressed }]} aria-hidden />
        ) : null}
      </View>
      {scrollsAway ? null : header}
      {scrollsAway ? null : banner}
      {scroll ? (
        <View style={styles.root}>
          <ScrollView
            testID="screen-scroll"
            style={styles.root}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            scrollEventThrottle={16}
            {...(scrollsAway ? { onScroll } : {})}
          >
            {scrollsAway ? (
              <View onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}>{header}</View>
            ) : null}
            {scrollsAway ? banner : null}
            {body}
          </ScrollView>
          {scrollsAway && compact ? (
            <View
              testID="screen-compact-header"
              style={[styles.compact, { top: 0, backgroundColor: c.hero }]}
            >
              {onBack ? (
                <IconButton
                  icon="chevron-back"
                  variant="onHero"
                  accessibilityLabel={t('ui.back')}
                  onPress={onBack}
                  testID="screen-compact-back"
                />
              ) : null}
              <View style={styles.compactTitle}>
                <Text variant="title3" color="textOnHero" numberOfLines={1}>
                  {title}
                </Text>
              </View>
            </View>
          ) : null}
        </View>
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
