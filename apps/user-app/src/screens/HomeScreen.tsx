import { memo, useCallback, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import {
  Button,
  Card,
  EmptyState,
  Icon,
  Text,
  elevation,
  formatNumber,
  radii,
  spacing,
  useTheme,
} from '@qc/ui';
import type { OccurrenceWithSession } from '@qc/contracts';
import { AreaPickerSheet } from '../components/AreaPickerSheet';
import { AyahOfTheDayCard } from '../components/AyahOfTheDayCard';
import { CommunityTodayCard } from '../components/CommunityTodayCard';
import { DaysReadCard } from '../components/DaysReadCard';
import { NextCircleCard } from '../components/NextCircleCard';
import { ReadAlongCard } from '../components/ReadAlongCard';
import { QueryBoundary } from '../components/QueryBoundary';
import { distanceParts, haversineMetres, nearestMetres } from '../core/distance';
import { useAppConfig } from '../features/config/useAppConfig';
import { useFeature } from '../features/reading/hooks';
import { HIJRI_MONTH_KEYS, hijriToday } from '../features/home/hijri';
import {
  nextRegisteredOccurrence,
  pickLeadOccurrence,
  useNextNearYou,
} from '../features/home/useHome';
import { occurrenceAsSession } from '../features/home/occurrence';
import { useMyRegistrations } from '../features/journey/hooks';
import { describeOccurrence } from '../features/nearby/schedule';
import { useOrigin } from '../features/nearby/useOrigin';
import { useUnreadCount } from '../features/updates/hooks';
import { useI18n } from '../i18n/I18nProvider';
import { useNav } from '../nav/NavProvider';
import { useAuthStatus, usePreferences } from '../providers/hooks';
import { useServices } from '../providers/services';
import { useAreas, useCities } from '../features/places/usePlaces';
import { MapPreviewCard } from '../ui/MapPreviewCard';
import { PictureCard } from '../ui/PictureCard';
import { SearchButton } from '../ui/SearchButton';
import { useStartFrameDeferral } from '../ui/startFrame';
import { TabFrame } from '../ui/TabFrame';
import { HomePrayerTimes } from '../ui/HomePrayerTimes';
import { useTextWeight } from '../ui/textWeight';
import { venueMapUrl } from '../features/session/links';

/** The gutter of the drawings: 20 dp each side (`.iq-section`). */
const GUTTER = 20;

const styles = StyleSheet.create({
  // The green header (`.iq-hero-gradient`): 14 on top, 20 at the sides and 72 under the top row,
  // 54 of which the next-circle card covers.
  hero: { paddingTop: 14, paddingHorizontal: GUTTER, paddingBottom: 72 },
  heroSolid: { paddingBottom: 72, borderBottomStartRadius: 28, borderBottomEndRadius: 28 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  heroCard: { marginTop: -54, marginHorizontal: GUTTER, zIndex: 6 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  area: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1, minHeight: 32 },
  areaText: { flexShrink: 1 },
  season: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: radii.pill },
  bell: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: { position: 'absolute', top: 6, end: 7, width: 6, height: 6, borderRadius: 3 },
  // A page heading for screen readers: Home shows no big title (D17), the area leads instead.
  hidden: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
  gutter: { paddingHorizontal: GUTTER },
  list: { gap: spacing.md },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.lg,
    paddingHorizontal: GUTTER,
  },
  grow: { flex: 1 },
  filter: {
    width: 42,
    height: 42,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    // Invisible normally; forced colours (Windows high contrast) paint it, so the filled
    // button keeps an edge when its fill is taken away (A-07).
    borderWidth: 2,
    borderColor: 'transparent',
  },
  prayer: { paddingTop: 14, paddingHorizontal: GUTTER },
  near: { paddingTop: 18, paddingStart: GUTTER },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
    paddingEnd: GUTTER,
  },
  headTitle: { flexShrink: 1 },
  flush: { paddingEnd: 0 },
  carousel: { gap: spacing.md, paddingEnd: GUTTER, paddingBottom: spacing.xs },
  nearState: { paddingEnd: GUTTER },
  special: { paddingTop: spacing.lg, paddingHorizontal: GUTTER },
  specialCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 13,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.card,
    borderWidth: 1,
  },
  specialText: { flex: 1 },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  below: { paddingTop: spacing.xl, paddingHorizontal: GUTTER, gap: spacing.xl },
});

/** Grows the 32 dp header buttons' press area to 48 dp. */
const SLOP = 8;

/** A portrait picture card in the "near you" row (H4, D17): 136 × 168 on Home. */
const PICTURE_WIDTH = 136;
const PICTURE_HEIGHT = 168;

/** The five prayers, in order, for the strip's placeholder before the content package loads. */
const PRAYER_KEYS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;

/** Unread updates for the person signed in; none when signed out. */
function useHomeUnread(): number {
  const status = useAuthStatus();
  const unread = useUnreadCount();
  return status === 'signedIn' ? unread : 0;
}

/**
 * The bell in the header reads the unread count itself, so the count arriving after start-up
 * draws only the bell, not the whole of Home. As drawn: a 32 dp glass circle with an amber dot
 * when something is unread; the count is in its name.
 */
const HomeBell = memo(function HomeBell() {
  const { t } = useI18n();
  const nav = useNav();
  const theme = useTheme();
  const c = theme.colors;
  const unreadCount = useHomeUnread();
  return (
    <Pressable
      role="button"
      aria-label={
        unreadCount > 0
          ? `${t('updates.title')}, ${t('ui.unread', { count: unreadCount })}`
          : t('updates.title')
      }
      testID="home-bell"
      hitSlop={SLOP}
      onPress={() => nav.go({ name: 'updates' })}
      style={({ pressed }) => [
        styles.bell,
        {
          backgroundColor: pressed ? c.heroGlassPressed : c.heroGlass,
          ...(theme.mode === 'highContrast' ? { borderWidth: 1, borderColor: c.borderStrong } : {}),
          transform: pressed && !theme.reduceMotion ? [{ scale: 0.94 }] : undefined,
        },
      ]}
    >
      <Icon name="bell" size={16} color={c.textOnHero} />
      {unreadCount > 0 ? (
        <View
          aria-hidden
          testID="home-bell-dot"
          style={[styles.bellDot, { backgroundColor: c.progressWarn }]}
        />
      ) : null}
    </Pressable>
  );
});

/**
 * The area at the start of the green header (D17): a pin, "City · Area" in white and a chevron.
 * It opens the area sheet, where city and area can both change.
 */
function AreaTrigger({ label, onPress }: { label: string; onPress: () => void }) {
  const { t } = useI18n();
  const c = useTheme().colors;
  return (
    <Pressable
      role="button"
      aria-label={t('home.area.change', { place: label })}
      testID="home-area"
      hitSlop={SLOP}
      onPress={onPress}
      style={({ pressed }) => [styles.area, { opacity: pressed ? 0.8 : 0.95 }]}
    >
      <Icon name="pin" size={13} color={c.textOnHero} />
      <View style={styles.areaText}>
        <Text color="textOnHero" numberOfLines={1} decorative variant="label">
          {label}
        </Text>
      </View>
      <Icon name="chevron-down" size={11} color={c.textOnHero} />
    </Pressable>
  );
}

/**
 * The special programme row at the foot of the fold (D17): a white card with an amber line
 * (the programme and when), the title and venue in bold, and a chevron. It shows the season's
 * other programme when one is coming; until then a sample row, marked as one, opens Nearby.
 */
function SpecialProgramCard({ item }: { item: OccurrenceWithSession | undefined }) {
  const { t, l, locale } = useI18n();
  const nav = useNav();
  const theme = useTheme();
  const w = useTextWeight();
  const c = theme.colors;
  let eyebrow: string;
  let line: string;
  let lineLang: 'en' | 'ur' | undefined;
  let onPress: () => void;
  let testID: string;
  if (item) {
    const session = occurrenceAsSession(item);
    const title = l(session.title);
    const venue = l(session.venue.name);
    const when = describeOccurrence(item, session.timezone, locale);
    eyebrow = t('home.dora.when', { program: t(`programs.${session.program}`), when });
    line = `${title.text}${t('schedule.separator')}${venue.text}`;
    lineLang = title.lang;
    onPress = () => nav.go({ name: 'session', sessionId: item.sessionId });
    testID = `home-other-${item.id}`;
  } else {
    eyebrow = t('home.special.sampleWhen');
    line = t('home.special.sampleTitle');
    onPress = () => nav.tab({ name: 'nearby' });
    testID = 'home-special-sample';
  }
  return (
    <View style={styles.special}>
      <Pressable
        role="button"
        aria-label={`${eyebrow}, ${line}`}
        testID={testID}
        onPress={onPress}
        style={({ pressed }) => [
          styles.specialCard,
          {
            backgroundColor: pressed ? c.surfaceMuted : c.surface,
            borderColor: theme.mode === 'highContrast' ? c.borderStrong : c.hairline,
            boxShadow: theme.mode === 'light' ? elevation.low : undefined,
          },
        ]}
      >
        <View style={styles.specialText}>
          <Text color="textWarning" decorative numberOfLines={1} variant="caption" style={w('700')}>
            {eyebrow}
          </Text>
          <Text
            decorative
            numberOfLines={2}
            {...(lineLang ? { lang: lineLang } : {})}
            variant="label"
            style={[w('700'), { marginTop: 2 }]}
          >
            {line}
          </Text>
        </View>
        <Icon name="chevron-forward" size={15} color={c.textMuted} />
      </Pressable>
    </View>
  );
}

/** A section's "See all" link at the end of its title row (`.iq-see-more`). */
function SeeAll({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID: string;
}) {
  const c = useTheme().colors;
  const w = useTextWeight();
  return (
    <Pressable role="link" onPress={onPress} testID={testID} hitSlop={SLOP} style={styles.seeAll}>
      <Text variant="caption" color="textSecondary" style={w('600')}>
        {label}
      </Text>
      <Icon name="chevron-forward" size={11} color={c.textSecondary} />
    </Pressable>
  );
}

/** A section title on Home (`.iq-section-title`): 16 bold. */
function HomeSectionHead({
  title,
  action,
  flush,
}: {
  title: string;
  action?: ReactNode;
  /** True inside a block that already has the gutter on both sides. */
  flush?: boolean;
}) {
  const w = useTextWeight();
  return (
    <View style={[styles.head, flush ? styles.flush : null]}>
      <View style={styles.headTitle}>
        <Text variant="title3" heading={2} style={w('700', { letterSpacing: -0.25 })}>
          {title}
        </Text>
      </View>
      {action}
    </View>
  );
}

export function HomeScreen() {
  const { t, l, locale } = useI18n();
  const nav = useNav();
  const theme = useTheme();
  const w = useTextWeight();
  const c = theme.colors;
  const { content, now, openUrl } = useServices();
  const prefs = usePreferences();
  const config = useAppConfig();
  const next = useNextNearYou();
  const registrations = useMyRegistrations();
  const cities = useCities();
  const areas = useAreas(prefs.cityId);
  // The same "near me" point as Nearby: the chosen area's centre, no phone location needed.
  const origin = useOrigin();
  const { PrayerStrip } = content;
  const [showArea, setShowArea] = useState(false);
  // Stable, so the memoised strip does not draw again each time Home does.
  const openPrayer = useCallback(() => nav.tab({ name: 'quran' }), [nav]);
  // The map, the ayah, the reading cards and the shortcuts sit below the fold on a phone: on the
  // web start they mount a frame after the first one, so Home's first frame draws sooner.
  const belowFold = useStartFrameDeferral();

  const mine = registrations.data ? nextRegisteredOccurrence(registrations.data, now()) : undefined;
  const leadingProgram = config.seasonMode === 'dora' ? 'dora' : 'circles';
  const otherProgram = leadingProgram === 'dora' ? 'circles' : 'dora';
  const city = cities.data?.find((x) => x.id === prefs.cityId);
  const area = areas.data?.find((x) => x.id === prefs.areaId);
  const items = next.data;
  const lead = items ? pickLeadOccurrence(items, leadingProgram) : undefined;
  const other = items?.find((o) => o.session.program === otherProgram && o.id !== lead?.id);
  const daysRead = useFeature('reading_days');
  const community = useFeature('community_today');
  const hijri = hijriToday(now(), config.hijriOffsetDays);
  const hijriMonth = hijri ? t(HIJRI_MONTH_KEYS[hijri.month - 1] ?? 'prayer.hijriMonth.1') : '';
  const hijriText = hijri
    ? t('home.hijri.date', {
        day: formatNumber(hijri.day, locale),
        month: hijriMonth,
        year: formatNumber(hijri.year, locale),
      })
    : null;
  const areaLabel = city
    ? area
      ? `${l(city.name).text} · ${l(area.name).text}`
      : l(city.name).text
    : t('home.area.choose');
  const distanceText = (metres: number) => {
    const parts = distanceParts(metres, locale);
    return parts.unit === 'km'
      ? t('home.distance.km', { distance: parts.value })
      : t('home.distance.metres', { distance: parts.value });
  };
  // Worked out on the phone from the area centre; without one the card keeps the plain count.
  const nearest =
    origin && items
      ? nearestMetres(
          origin,
          items.map((o) => o.session.venue),
        )
      : null;
  const mapTitle = (count: number) =>
    nearest === null
      ? t('home.map.count', { count })
      : t('home.map.countNearest', { count, distance: distanceText(nearest) });
  const venueDistance = (venue: { lat: number; lng: number }) =>
    origin ? distanceText(haversineMetres(origin, venue)) : undefined;

  const heroSession = mine ? mine.registration.session : lead ? occurrenceAsSession(lead) : null;
  const heroDistance = heroSession ? venueDistance(heroSession.venue) : undefined;
  const heroCard = mine ? (
    <View testID="home-your-next">
      <NextCircleCard
        session={mine.registration.session}
        eyebrow={t('home.nextSession.title')}
        now={now()}
        {...(heroDistance ? { distance: heroDistance } : {})}
        onPress={() => nav.go({ name: 'session', sessionId: mine.registration.sessionId })}
        onDirections={() => void openUrl(venueMapUrl(mine.registration.session.venue))}
        onReadPortion={() => {
          const occ = mine.registration.session.nextOccurrence;
          const p = occ?.portion;
          if (p?.kind === 'surah') {
            nav.tab({
              name: 'quran',
              reader: { surah: p.surah, ayah: 1, at: now().getTime() },
            });
          } else if (p?.kind === 'ayah_range') {
            nav.tab({
              name: 'quran',
              reader: { surah: p.surah, ayah: p.fromAyah, at: now().getTime() },
            });
          } else {
            nav.tab({ name: 'quran' });
          }
        }}
        onRegistration={() => nav.tab({ name: 'journey' })}
        testID="home-lead-card"
      />
    </View>
  ) : lead ? (
    <NextCircleCard
      session={occurrenceAsSession(lead)}
      eyebrow={t('home.nextSession.near')}
      now={now()}
      {...(heroDistance ? { distance: heroDistance } : {})}
      onPress={() => nav.go({ name: 'session', sessionId: lead.sessionId })}
      onDirections={() => void openUrl(venueMapUrl(lead.session.venue))}
      testID="home-lead-card"
    />
  ) : null;

  // D17: deep emerald, through the mid green and a pale green, into the page, fading out about
  // halfway down the next-circle card. Native and high contrast keep the solid green.
  const fade = Platform.OS === 'web' && theme.mode !== 'highContrast';
  const heroLook: ViewStyle = fade
    ? ({
        backgroundColor: c.hero,
        backgroundImage: `linear-gradient(180deg, ${c.hero} 0%, ${c.heroEnd} 48%, color-mix(in srgb, ${c.heroEnd} 60%, ${c.background}) 78%, ${c.background} 100%)`,
      } as ViewStyle)
    : { ...styles.heroSolid, backgroundColor: c.hero };

  // The header block holds the green and the card half on it. Its own colour is the hero green
  // (the green status-bar strip and forced colours read it), painted over on the web by the
  // page colour, so the green shows only where the fade above draws it.
  const headerLook: ViewStyle | null = fade
    ? ({
        backgroundColor: c.hero,
        backgroundImage: `linear-gradient(${c.background}, ${c.background})`,
      } as ViewStyle)
    : null;

  const header = (
    <View testID="screen-header" style={headerLook}>
      <View style={[styles.hero, heroLook]}>
        <View style={styles.hidden}>
          <Text variant="title1" color="textOnHero" heading={1}>
            {t('tabs.home')}
          </Text>
        </View>
        <View style={styles.topRow}>
          <AreaTrigger label={areaLabel} onPress={() => setShowArea(true)} />
          <View style={styles.actions}>
            {hijri && hijriText ? (
              <View
                testID="home-season"
                style={[
                  styles.season,
                  {
                    backgroundColor: c.surface,
                    boxShadow: theme.mode === 'light' ? elevation.low : undefined,
                    ...(theme.mode === 'highContrast'
                      ? { borderWidth: 1, borderColor: c.borderStrong }
                      : {}),
                  },
                ]}
              >
                <Text
                  variant="eyebrow"
                  color="textAccent"
                  accessibilityLabel={hijriText}
                  numberOfLines={1}
                  style={[
                    w('800', { letterSpacing: 0.2 }),
                    theme.script === 'latin' ? { textTransform: 'uppercase' } : null,
                  ]}
                >
                  {t('home.hijri.short', {
                    day: formatNumber(hijri.day, locale),
                    month: hijriMonth,
                  })}
                </Text>
              </View>
            ) : null}
            <HomeBell />
          </View>
        </View>
      </View>
      {heroCard ? <View style={styles.heroCard}>{heroCard}</View> : null}
    </View>
  );

  return (
    <TabFrame header={header} green testID="home-screen">
      <View style={styles.searchRow}>
        <View style={styles.grow}>
          <SearchButton
            label={t('nearby.search.label')}
            placeholder={t('nearby.search.placeholder')}
            onPress={() => nav.tab({ name: 'nearby' })}
            testID="home-search"
          />
        </View>
        <Pressable
          role="button"
          aria-label={t('nearby.filters.open')}
          testID="home-filters"
          hitSlop={3}
          onPress={() => nav.tab({ name: 'nearby' })}
          style={({ pressed }) => [
            styles.filter,
            {
              backgroundColor: pressed ? c.accentPressed : c.accent,
              transform: pressed && !theme.reduceMotion ? [{ scale: 0.94 }] : undefined,
            },
          ]}
        >
          <Icon name="sliders" size={16} color={c.textOnAccent} />
        </Pressable>
      </View>

      <View style={styles.prayer}>
        {PrayerStrip ? (
          <PrayerStrip onPress={openPrayer} {...(city ? { citySlug: city.slug } : {})} />
        ) : (
          <HomePrayerTimes
            prayers={PRAYER_KEYS.map((key) => ({ key, name: t(`prayer.${key}`), time: '--:--' }))}
            activeLabel={t('home.prayer.now')}
            accessibilityLabel={`${t('home.prayer.title')}. ${t('home.prayer.placeholder')}`}
            onPress={openPrayer}
            testID="home-prayer-placeholder"
          />
        )}
      </View>

      <View style={styles.near} testID="home-lead">
        <HomeSectionHead
          title={
            leadingProgram === 'dora' ? t('home.season.doraTitle') : t('home.season.circlesTitle')
          }
          action={
            items && items.length > 0 ? (
              <SeeAll
                label={t('home.near.seeAll')}
                onPress={() => nav.tab({ name: 'nearby' })}
                testID="home-see-all"
              />
            ) : undefined
          }
        />
        {!prefs.cityId ? (
          <View style={styles.nearState}>
            <Card variant="flat">
              <View style={styles.list}>
                <Text variant="body">{t('home.chooseCity')}</Text>
                <Button
                  variant="secondary"
                  label={t('home.chooseCity.action')}
                  onPress={() => nav.tab({ name: 'nearby' })}
                  testID="home-choose-city"
                />
              </View>
            </Card>
          </View>
        ) : null}
        <QueryBoundary query={next}>
          {(all) => {
            if (!lead) {
              return (
                <View style={styles.nearState}>
                  <EmptyState
                    title={t('home.nextSession.empty.title')}
                    description={
                      city
                        ? t('home.nextSession.empty.body')
                        : t('home.nextSession.empty.bodyNoCity')
                    }
                    action={{
                      label: t('home.nextSession.empty.action'),
                      onPress: () => nav.tab({ name: 'nearby' }),
                    }}
                    testID="home-lead-empty"
                  />
                </View>
              );
            }
            // The hero already shows the first session, so the pictures show the rest (and
            // the lead too when the hero is the person's own registration).
            const heroId = mine ? null : lead.id;
            const pictures = all.filter((o) => o.id !== heroId).slice(0, 8);
            if (pictures.length === 0) return null;
            return (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.carousel}
                testID="home-near"
              >
                {pictures.map((o) => {
                  const session = occurrenceAsSession(o);
                  const title = l(session.title);
                  const venue = l(session.venue.name).text;
                  const when = describeOccurrence(o, session.timezone, locale);
                  const distance = venueDistance(session.venue);
                  const section = t(`sections.${session.section}`);
                  return (
                    <PictureCard
                      key={o.id}
                      variant="portrait"
                      seed={session.venue.id}
                      width={PICTURE_WIDTH}
                      artHeight={PICTURE_HEIGHT}
                      title={title.text}
                      caption={venue}
                      section={session.section}
                      sectionLabel={section}
                      {...(distance ? { distance } : {})}
                      accessibilityLabel={[title.text, venue, when, section, distance]
                        .filter(Boolean)
                        .join(', ')}
                      onPress={() => nav.go({ name: 'session', sessionId: o.sessionId })}
                      testID={`home-near-${o.id}`}
                    />
                  );
                })}
              </ScrollView>
            );
          }}
        </QueryBoundary>
      </View>

      <SpecialProgramCard item={other} />

      {belowFold ? (
        <View style={styles.below}>
          <ReadAlongCard />

          {items && items.length > 0 ? (
            <View>
              <HomeSectionHead
                flush
                title={t('home.map.title')}
                action={
                  <SeeAll
                    label={t('home.map.open')}
                    onPress={() => nav.tab({ name: 'nearby' })}
                    testID="home-map-open"
                  />
                }
              />
              <MapPreviewCard
                pins={items.length}
                title={mapTitle(items.length)}
                caption={t('home.map.open')}
                onPress={() => nav.tab({ name: 'nearby' })}
                testID="home-map"
              />
            </View>
          ) : null}

          <AyahOfTheDayCard />

          {daysRead.on || community.on ? (
            <View style={styles.list} testID="home-reading">
              {daysRead.on ? <DaysReadCard /> : null}
              <CommunityTodayCard />
            </View>
          ) : null}
        </View>
      ) : null}
      <AreaPickerSheet
        visible={showArea}
        onClose={() => setShowArea(false)}
        cityId={prefs.cityId}
        value={prefs.areaId}
        onCityChange={(cityId) => void prefs.update({ cityId, areaId: null })}
        onChange={(areaId) => void prefs.update({ areaId })}
      />
    </TabFrame>
  );
}
