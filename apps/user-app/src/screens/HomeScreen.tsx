import { memo, useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  EmptyState,
  Icon,
  Text,
  formatNumber,
  minTouchTarget,
  radii,
  spacing,
  useTheme,
  type IconName,
} from '@qc/ui';
import { AyahOfTheDayCard } from '../components/AyahOfTheDayCard';
import { CommunityTodayCard } from '../components/CommunityTodayCard';
import { DaysReadCard } from '../components/DaysReadCard';
import { NextCircleCard } from '../components/NextCircleCard';
import { ReadAlongCard } from '../components/ReadAlongCard';
import { ProfileButton } from '../components/ProfileButton';
import { QueryBoundary } from '../components/QueryBoundary';
import { ScreenFrame } from '../components/ScreenFrame';
import { Section } from '../components/Section';
import { SessionCard } from '../components/SessionCard';
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
import { useCities } from '../features/places/usePlaces';
import { GlassButton } from '../ui/GlassButton';
import { MapPreviewCard } from '../ui/MapPreviewCard';
import { PictureCard } from '../ui/PictureCard';
import { SearchButton } from '../ui/SearchButton';
import { Shortcut } from '../ui/Shortcut';
import { venueMapUrl } from '../features/session/links';

const styles = StyleSheet.create({
  stack: { gap: spacing.xl },
  list: { gap: spacing.md },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  grow: { flex: 1 },
  filter: {
    width: minTouchTarget + spacing.sm,
    height: minTouchTarget + spacing.sm,
    borderRadius: radii.field,
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
});

/** Width of a picture card in the "near you" row (H4). */
const PICTURE_WIDTH = 176;

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

const HomeShortcuts = memo(function HomeShortcuts() {
  const { t } = useI18n();
  const nav = useNav();
  const unreadCount = useHomeUnread();
  const shortcuts: {
    key: string;
    icon: IconName;
    label: string;
    onPress: () => void;
    count?: number;
  }[] = [
    {
      key: 'quran',
      icon: 'book',
      label: t('home.also.quran'),
      onPress: () => nav.tab({ name: 'quran' }),
    },
    {
      key: 'prayer',
      icon: 'prayer',
      label: t('home.prayer.title'),
      onPress: () => nav.tab({ name: 'quran' }),
    },
    {
      key: 'qibla',
      icon: 'route',
      label: t('home.also.qibla'),
      onPress: () => nav.tab({ name: 'quran' }),
    },
    {
      key: 'updates',
      icon: 'bell',
      label: t('updates.title'),
      onPress: () => nav.go({ name: 'updates' }),
      ...(unreadCount > 0 ? { count: unreadCount } : {}),
    },
  ];
  return (
    <Section title={t('home.also.title')} testID="home-also">
      <View style={styles.shortcuts}>
        {shortcuts.map((item) => (
          <Shortcut
            key={item.key}
            icon={item.icon}
            label={item.label}
            {...(item.count
              ? {
                  count: item.count,
                  accessibilityLabel: `${item.label}, ${t('ui.unread', { count: item.count })}`,
                }
              : {})}
            onPress={item.onPress}
            testID={`home-also-${item.key}`}
          />
        ))}
      </View>
    </Section>
  );
});

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
  // The same "near me" point as Nearby: the chosen area's centre, no phone location needed.
  const origin = useOrigin();
  const { PrayerStrip } = content;
  // Stable, so the memoised strip does not draw again each time Home does.
  const openPrayer = useCallback(() => nav.tab({ name: 'quran' }), [nav]);

  const mine = registrations.data ? nextRegisteredOccurrence(registrations.data, now()) : undefined;
  const leadingProgram = config.seasonMode === 'dora' ? 'dora' : 'circles';
  const otherProgram = leadingProgram === 'dora' ? 'circles' : 'dora';
  const city = cities.data?.find((x) => x.id === prefs.cityId);
  const items = next.data;
  const lead = items ? pickLeadOccurrence(items, leadingProgram) : undefined;
  const other = items?.find((o) => o.session.program === otherProgram && o.id !== lead?.id);
  const daysRead = useFeature('reading_days');
  const community = useFeature('community_today');
  const hijri = hijriToday(now(), config.hijriOffsetDays);
  const hijriText = hijri
    ? t('home.hijri.date', {
        day: formatNumber(hijri.day, locale),
        month: t(HIJRI_MONTH_KEYS[hijri.month - 1] ?? 'prayer.hijriMonth.1'),
        year: formatNumber(hijri.year, locale),
      })
    : null;
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

  const heroCard = mine ? (
    <View testID="home-your-next">
      <NextCircleCard
        session={mine.registration.session}
        eyebrow={t('home.nextSession.title')}
        now={now()}
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
      onPress={() => nav.go({ name: 'session', sessionId: lead.sessionId })}
      onDirections={() => void openUrl(venueMapUrl(lead.session.venue))}
      testID="home-lead-card"
    />
  ) : null;

  return (
    <ScreenFrame
      title={t('tabs.home')}
      {...(hijriText ? { eyebrow: hijriText } : {})}
      {...(city ? { subtitle: l(city.name).text } : {})}
      actions={
        <View style={styles.actions}>
          <HomeBell />
          <ProfileButton />
        </View>
      }
      hero={heroCard}
      testID="home-screen"
    >
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
            style={[styles.filter, { backgroundColor: c.accent }]}
          >
            <Icon name="filter" size={22} color={c.textOnAccent} />
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

        <ReadAlongCard />

        <Section
          title={
            leadingProgram === 'dora' ? t('home.season.doraTitle') : t('home.season.circlesTitle')
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
                        const distance = origin
                          ? distanceText(haversineMetres(origin, session.venue))
                          : undefined;
                        return (
                          <PictureCard
                            key={o.id}
                            seed={session.venue.id}
                            width={PICTURE_WIDTH}
                            title={title.text}
                            caption={`${l(session.venue.name).text}${t('schedule.separator')}${when}`}
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
                    <>
                      <Text variant="label" color="textSecondary">
                        {otherProgram === 'dora' ? t('home.also.dora') : t('home.also.circles')}
                      </Text>
                      <SessionCard
                        session={occurrenceAsSession(other)}
                        emphasis="next"
                        onPress={() => nav.go({ name: 'session', sessionId: other.sessionId })}
                      />
                    </>
                  ) : null}
                </View>
              );
            }}
          </QueryBoundary>
        </Section>

        {items && items.length > 0 ? (
          <MapPreviewCard
            pins={items.length}
            title={mapTitle(items.length)}
            caption={t('home.map.open')}
            onPress={() => nav.tab({ name: 'nearby' })}
            testID="home-map"
          />
        ) : null}

        <AyahOfTheDayCard />

        {daysRead.on || community.on ? (
          <View style={styles.list} testID="home-reading">
            {daysRead.on ? <DaysReadCard /> : null}
            <CommunityTodayCard />
          </View>
        ) : null}

        <HomeShortcuts />
      </View>
    </ScreenFrame>
  );
}
