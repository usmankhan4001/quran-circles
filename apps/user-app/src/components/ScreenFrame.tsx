import { useState, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
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
  Icon,
  radii,
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
  /**
   * `dark` (D17): the picture runs under the whole header with a dark fade, and the title sits
   * over the picture instead of on the green. The page below stays white.
   */
  fade?: 'dark';
  /** A line above the title on a dark-faded picture, such as the section tag and the schedule. */
  overline?: ReactNode;
  /**
   * With `fade: 'dark'`: only the picture and its buttons, shorter, with the title left to the
   * page below it (the venue page, D17). The page then carries the level-1 heading itself.
   */
  bare?: boolean;
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
  /**
   * A plain white top (D17): a back button, the title in the middle, no green. For a full-screen
   * form such as registration.
   */
  plain?: boolean;
  children: ReactNode;
  /** Content kept below the scrolling area, for the main action of a form. */
  footer?: ReactNode;
  /** The footer floats on the page with no bar behind it, as the session's dark pill (D17). */
  floatingFooter?: boolean;
  /** False when the content scrolls by itself (a long list such as the Quran reader). */
  scroll?: boolean;
  /** Leaves out the page gutter, for content that runs edge to edge. */
  flush?: boolean;
  testID?: string;
}

/** Height of the drawn place at the top of a session or venue (S1). */
export const PHOTO_HEIGHT = 230;
/** The glass back pill and share circle are drawn at 32 dp, with their touch area grown to 48. */
const GLASS_SIZE = 32;
const GLASS_SLOP = (minTouchTarget - GLASS_SIZE) / 2;
/** Height of the picture under a dark-faded header (D17). */
const PHOTO_HEIGHT_DARK = 215;
/** Height of the bare picture on top of a venue (D17). */
const PHOTO_HEIGHT_BARE = 160;
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
  darkHeader: { minHeight: PHOTO_HEIGHT_DARK, overflow: 'hidden', position: 'relative' },
  darkArt: { position: 'absolute', top: 0, start: 0, end: 0 },
  fill: { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 },
  darkContent: {
    flex: 1,
    minHeight: PHOTO_HEIGHT_DARK,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg + spacing.xs,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg + spacing.xxs,
    gap: spacing.lg,
  },
  darkTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  glassPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: GLASS_SIZE,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
  },
  glassRound: {
    width: GLASS_SIZE,
    height: GLASS_SIZE,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingFooter: { paddingHorizontal: spacing.lg + spacing.xs, paddingTop: spacing.sm },
  darkTitles: { gap: spacing.xs + spacing.xxs },
  plainBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: minTouchTarget + spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  plainSide: { width: minTouchTarget },
  plainTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: minTouchTarget + spacing.sm,
    paddingHorizontal: screenGutter,
    paddingTop: spacing.sm,
  },
  plainTitle: { flex: 1 },
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
 * The top of a session (D17): the drawn place under the whole header with a dark fade, glass
 * back and share buttons on it, and the overline and title over its lower edge in white.
 */
function DarkPhotoHeader({
  photo,
  title,
  onBack,
  actions,
}: {
  photo: ScreenPhoto;
  title: string;
  onBack?: () => void;
  actions?: ReactNode;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const c = theme.colors;
  const web = Platform.OS === 'web' && theme.mode !== 'highContrast';
  // Two fades stacked: light at the top for the buttons, deep at the foot for the title. Off the
  // web (and in high contrast) one even scrim keeps the white text readable.
  const bare = photo.bare === true;
  const height = bare ? PHOTO_HEIGHT_BARE : PHOTO_HEIGHT_DARK;
  const fade: ViewStyle = bare
    ? web
      ? ({
          backgroundImage: `linear-gradient(180deg, ${c.scrim} 0%, transparent 60%)`,
        } as ViewStyle)
      : {}
    : web
      ? ({
          backgroundImage: `linear-gradient(180deg, ${c.scrim} 0%, transparent 45%, ${c.scrim} 100%), linear-gradient(180deg, transparent 35%, ${c.scrim} 100%), linear-gradient(180deg, transparent 55%, ${c.scrim} 100%)`,
          backgroundColor: c.scrim,
        } as ViewStyle)
      : { backgroundColor: c.scrim };
  return (
    <View
      testID="screen-header"
      style={[styles.darkHeader, { backgroundColor: c.hero, minHeight: height }]}
    >
      <View style={styles.darkArt}>
        <VenueArt seed={photo.seed} height={height} testID={photo.testID ?? 'screen-photo'} />
      </View>
      <View aria-hidden pointerEvents="none" style={[styles.fill, fade]} />
      <View style={[styles.darkContent, { minHeight: height }]}>
        <View style={styles.darkTop}>
          {onBack ? (
            <Pressable
              role="button"
              aria-label={t('ui.back')}
              onPress={onBack}
              hitSlop={GLASS_SLOP}
              testID="screen-back"
              style={({ pressed }) => [
                styles.glassPill,
                { backgroundColor: pressed ? c.heroGlassPressed : c.heroGlass },
              ]}
            >
              <Icon name="chevron-back" size={14} color={c.textOnHero} />
              <Text variant="caption" color="textOnHero" strong>
                {t('ui.back')}
              </Text>
            </Pressable>
          ) : (
            <View />
          )}
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {actions}
            {photo.onShare ? (
              <Pressable
                role="button"
                aria-label={t('session.share')}
                onPress={photo.onShare}
                hitSlop={GLASS_SLOP}
                testID="screen-share"
                style={({ pressed }) => [
                  styles.glassRound,
                  { backgroundColor: pressed ? c.heroGlassPressed : c.heroGlass },
                ]}
              >
                <Icon name="share" size={16} color={c.textOnHero} />
              </Pressable>
            ) : null}
          </View>
        </View>
        {bare ? null : (
          <View style={styles.darkTitles}>
            {photo.overline}
            <Text variant="title2" color="textOnHero" heading={1}>
              {title}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

/** The plain white top of a full-screen form (D17): back, the title in the middle, a spacer. */
function PlainHeader({
  title,
  onBack,
  actions,
}: {
  title: string;
  onBack?: () => void;
  actions?: ReactNode;
}) {
  const { t } = useI18n();
  if (!onBack) {
    // A tab page (D17): its name large at the start, on white, with any action at the end.
    return (
      <View testID="screen-header" style={styles.plainTab}>
        <View style={styles.plainTitle}>
          <Text variant="title2" heading={1}>
            {title}
          </Text>
        </View>
        {actions}
      </View>
    );
  }
  return (
    <View testID="screen-header" style={styles.plainBar}>
      <View style={styles.plainSide}>
        <IconButton
          icon="chevron-back"
          accessibilityLabel={t('ui.back')}
          onPress={onBack}
          testID="screen-back"
        />
      </View>
      <View style={styles.plainTitle}>
        <Text variant="title3" align="center" heading={1} numberOfLines={2}>
          {title}
        </Text>
      </View>
      <View style={styles.plainSide}>{actions}</View>
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
  plain,
  children,
  footer,
  floatingFooter,
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

  const header = plain ? (
    <PlainHeader title={title} {...(onBack ? { onBack } : {})} {...(actions ? { actions } : {})} />
  ) : photo?.fade === 'dark' ? (
    <DarkPhotoHeader
      photo={photo}
      title={title}
      {...(onBack ? { onBack } : {})}
      {...(actions ? { actions } : {})}
    />
  ) : photo ? (
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
  const scrollsAway = scroll && !sheet && !plain;

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
      <View style={{ backgroundColor: plain ? c.background : c.hero, paddingTop: insets.top }}>
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
      {footer && floatingFooter ? (
        <View
          style={[
            styles.floatingFooter,
            {
              backgroundColor: c.background,
              paddingBottom: spacing.lg + spacing.xxs + insets.bottom,
            },
          ]}
        >
          {footer}
        </View>
      ) : footer ? (
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
