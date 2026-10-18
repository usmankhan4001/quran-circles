import { memo, useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  EmptyState,
  HeroHeader,
  Icon,
  Text,
  elevation,
  formatNumber,
  minTouchTarget,
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
import { Section } from '../components/Section';
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
import { GlassButton } from '../ui/GlassButton';
import { MapPreviewCard } from '../ui/MapPreviewCard';
import { PictureCard } from '../ui/PictureCard';
import { SearchButton } from '../ui/SearchButton';
import { useStartFrameDeferral } from '../ui/startFrame';
import { TabFrame } from '../ui/TabFrame';
import { venueMapUrl } from '../features/session/links';

const styles = StyleSheet.create({
  stack: { gap: spacing.xl },
  list: { gap: spacing.md },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  grow: { flex: 1 },
  filter: {
    width: minTouchTarget + spacing.sm,
    height: minTouchTarget + spacing.sm,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    // Invisible normally; forced colours (Windows high contrast) paint it, so the filled
    // button keeps an edge when its fill is taken away (A-07).
    borderWidth: 2,
    borderColor: 'transparent',
  },
  carousel: { gap: spacing.md, paddingBottom: spacing.sm, paddingHorizontal: spacing.xxs },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  shortcuts: { flexDirection: 'row', gap: spacing.sm },
  area: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: minTouchTarget,
    flexShrink: 1,
    paddingEnd: spacing.sm,
  },
  areaText: { flexShrink: 1 },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  // A page heading for screen readers: Home shows no big title (D17), the area leads instead.
  hidden: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
  secondary: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  secondaryText: { flex: 1, gap: spacing.xxs },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    minHeight: minTouchTarget,
    paddingStart: spacing.sm,
  },
});

/** Width of a portrait picture card in the "near you" row (H4, D17). */
const PICTURE_WIDTH = 136;

/** Unread updates for the person signed in; none when signed out. */
function useHomeUnread(): number {
  const status = useAuthStatus();
  const unread = useUnreadCount();
  return status === 'signedIn' ? unread : 0;
}

/**
 * The bell in the header and the shortcuts at the bottom read the unread count themselves, so
 * the count arriving after start-up draws only them, not the whole of Home.
 */
const HomeBell = memo(function HomeBell() {
  const { t } = useI18n();
  const nav = useNav();
  const unreadCount = useHomeUnread();
  return (
    <GlassButton
      icon="bell"
      accessibilityLabel={
        unreadCount > 0
          ? `${t('updates.title')}, ${t('ui.unread', { count: unreadCount })}`
          : t('updates.title')
      }
      count={unreadCount}
      onPress={() => nav.go({ name: 'updates' })}
      testID="home-bell"
    />
  );
});

/**
 * The area at the start of the green header (D17): a pin, "City · Area" in white and a chevron.
 * It opens the area sheet, where city and area can both change.
 */
function AreaTrigger({ label, onPress }: { label: string; onPress: () => void }) {
  const { t } = useI18n();
  const theme = useTheme();
  const c = theme.colors;
  return (
    <Pressable
      role="button"
      aria-label={t('home.area.change', { place: label })}
      testID="home-area"
      onPress={onPress}
      style={({ pressed }) => [styles.area, pressed ? { opacity: 0.8 } : null]}
    >
      <Icon name="pin" size={18} color={c.textOnHero} />
      <View style={styles.areaText}>
        <Text variant="label" color="textOnHero" numberOfLines={1} decorative>
          {label}
        </Text>
      </View>
      <Icon name="chevron-down" size={16} color={c.textOnHero} />
    </Pressable>
  );
}

/**
 * The second programme of the season as one compact row (D17): an amber line with the programme
 * and when, then the title and the venue, and a chevron. It opens the session.
 */
function SecondaryProgramCard({ item }: { item: OccurrenceWithSession }) {
  const { t, l, locale } = useI18n();
  const nav = useNav();
  const c = useTheme().colors;
  const session = occurrenceAsSession(item);
  const title = l(session.title);
  const venue = l(session.venue.name);
  const when = describeOccurrence(item, session.timezone, locale);
  const program = t(`programs.${session.program}`);
  const line = `${title.text}${t('schedule.separator')}${venue.text}`;
  return (
    <Card
      onPress={() => nav.go({ name: 'session', sessionId: item.sessionId })}
      accessibilityLabel={[program, when, title.text, venue.text].join(', ')}
      testID={`home-other-${item.id}`}
    >
      <View style={styles.secondary}>
        <View style={styles.secondaryText}>
          <Text variant="caption" color="textWarning" strong decorative>
            {t('home.dora.when', { program, when })}
          </Text>
          <Text variant="label" decorative numberOfLines={2}>
            {line}
          </Text>
        </View>
        <Icon name="chevron-forward" size={18} color={c.textMuted} />
      </View>
    </Card>
  );
}

/** A section's "See all" link at the end of its title row. */
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
  return (
    <Pressable role="link" onPress={onPress} testID={testID} style={styles.seeAll}>
      <Text variant="caption" color="textSecondary" strong>
        {label}
      </Text>
      <Icon name="chevron-forward" size={14} color={c.textSecondary} />
    </Pressable>
  );
}

export function HomeScreen() {
  const { t, l, locale } = useI18n();
  const nav = useNav();
  const theme = useTheme();
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
  const sep = t('schedule.separator');
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

  const header = (
    <HeroHeader
      testID="screen-header"
      leading={<AreaTrigger label={areaLabel} onPress={() => setShowArea(true)} />}
      actions={
        <View style={styles.actions}>
          {hijri && hijriText ? (
            <View
              testID="home-season"
              style={[
                styles.pill,
                {
                  backgroundColor: c.surface,
                  borderColor: theme.mode === 'highContrast' ? c.borderStrong : c.surface,
                },
              ]}
            >
              <Text variant="caption" color="textAccent" strong accessibilityLabel={hijriText}>
                {t('home.hijri.short', { day: formatNumber(hijri.day, locale), month: hijriMonth })}
              </Text>
            </View>
          ) : null}
          <HomeBell />
        </View>
      }
    >
      <View style={styles.hidden}>
        <Text variant="title1" color="textOnHero" heading={1}>
          {t('tabs.home')}
        </Text>
      </View>
      {heroCard}
    </HeroHeader>
  );

  return (
    <TabFrame header={header} green testID="home-screen">
      <View style={styles.stack}>
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
            onPress={() => nav.tab({ name: 'nearby' })}
            style={({ pressed }) => [
              styles.filter,
              {
                backgroundColor: pressed ? c.accentPressed : c.accent,
                boxShadow: theme.mode === 'light' ? elevation.low : undefined,
                transform: pressed && !theme.reduceMotion ? [{ scale: 0.94 }] : undefined,
              },
            ]}
          >
            <Icon name="sliders" size={20} color={c.textOnAccent} />
          </Pressable>
        </View>

        {PrayerStrip ? (
          <PrayerStrip onPress={openPrayer} />
        ) : (
          <Card onPress={() => nav.tab({ name: 'quran' })} testID="home-prayer-placeholder">
            <Text variant="label">{t('home.prayer.title')}</Text>
            <Text variant="caption" color="textSecondary">
              {t('home.prayer.placeholder')}
            </Text>
          </Card>
        )}

        <Section
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
          testID="home-lead"
        >
          {!prefs.cityId ? (
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
          ) : null}
          <QueryBoundary query={next}>
            {(all) => {
              if (!lead) {
                return (
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
                );
              }
              // The hero already shows the first session, so the pictures show the rest (and
              // the lead too when the hero is the person's own registration).
              const heroId = mine ? null : lead.id;
              const pictures = all.filter((o) => o.id !== heroId).slice(0, 8);
              return (
                <View style={styles.list}>
                  {pictures.length > 0 ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.carousel}
                      testID="home-near"
                    >
                      {pictures.map((o) => {
                        const session = occurrenceAsSession(o);
                        const title = l(session.title);
                        const when = describeOccurrence(o, session.timezone, locale);
                        const distance = venueDistance(session.venue);
                        return (
                          <PictureCard
                            key={o.id}
                            variant="portrait"
                            seed={session.venue.id}
                            width={PICTURE_WIDTH}
                            title={title.text}
                            caption={`${l(session.venue.name).text}${sep}${when}`}
                            section={session.section}
                            sectionLabel={t(`sections.${session.section}`)}
                            {...(distance ? { distance } : {})}
                            onPress={() => nav.go({ name: 'session', sessionId: o.sessionId })}
                            testID={`home-near-${o.id}`}
                          />
                        );
                      })}
                    </ScrollView>
                  ) : null}
                  {other && !pictures.some((o) => o.id === other.id) ? (
                    <SecondaryProgramCard item={other} />
                  ) : null}
                </View>
              );
            }}
          </QueryBoundary>
        </Section>

        {belowFold ? <ReadAlongCard /> : null}

        {belowFold && items && items.length > 0 ? (
          <Section
            title={t('home.map.title')}
            action={
              <SeeAll
                label={t('home.map.open')}
                onPress={() => nav.tab({ name: 'nearby' })}
                testID="home-map-open"
              />
            }
          >
            <MapPreviewCard
              pins={items.length}
              title={mapTitle(items.length)}
              caption={t('home.map.open')}
              onPress={() => nav.tab({ name: 'nearby' })}
              testID="home-map"
            />
          </Section>
        ) : null}

        {belowFold ? <AyahOfTheDayCard /> : null}

        {belowFold && (daysRead.on || community.on) ? (
          <View style={styles.list} testID="home-reading">
            {daysRead.on ? <DaysReadCard /> : null}
            <CommunityTodayCard />
          </View>
        ) : null}
      </View>
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
