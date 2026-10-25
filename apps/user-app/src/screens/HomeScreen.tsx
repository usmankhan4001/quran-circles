import { memo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  Icon,
  IconButton,
  SectionHeader,
  Text,
  TimeRow,
  spacing,
  useTheme,
} from '@qc/ui';
import { AreaPickerSheet } from '../components/AreaPickerSheet';
import { AyahOfTheDayCard } from '../components/AyahOfTheDayCard';
import { CommunityTodayCard } from '../components/CommunityTodayCard';
import { DaysReadCard } from '../components/DaysReadCard';
import { NextCircleCard } from '../components/NextCircleCard';
import { QueryBoundary } from '../components/QueryBoundary';
import { ReadAlongCard } from '../components/ReadAlongCard';
import { distanceParts, haversineMetres } from '../core/distance';
import { splitClock } from '../features/home/clock';
import { occurrenceAsSession } from '../features/home/occurrence';
import {
  nextRegisteredOccurrence,
  pickLeadOccurrence,
  useNextNearYou,
} from '../features/home/useHome';
import { useMyRegistrations } from '../features/journey/hooks';
import { describeWhenParts } from '../features/nearby/schedule';
import { useOrigin } from '../features/nearby/useOrigin';
import { useAreas, useCities } from '../features/places/usePlaces';
import { useAppConfig } from '../features/config/useAppConfig';
import { useFeature } from '../features/reading/hooks';
import { venueMapUrl } from '../features/session/links';
import { useUnreadCount } from '../features/updates/hooks';
import { useI18n } from '../i18n/I18nProvider';
import { useNav } from '../nav/NavProvider';
import { useAuthState, useAuthStatus, useOffline, usePreferences } from '../providers/hooks';
import { useServices } from '../providers/services';
import { useStartFrameDeferral } from '../ui/startFrame';
import { TabFrame } from '../ui/TabFrame';

const GUTTER = 20;

const styles = StyleSheet.create({
  gutter: { paddingHorizontal: GUTTER },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xs,
    minHeight: 48,
    paddingHorizontal: spacing.sm,
  },
  bellWrap: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 11, end: 12, width: 8, height: 8, borderRadius: 4 },
  profile: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  header: { gap: spacing.xs, paddingBottom: spacing.sm },
  area: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 32,
    alignSelf: 'flex-start',
  },
  section: { paddingTop: spacing.xl, gap: spacing.xs },
  list: { gap: spacing.md },
  below: { paddingTop: spacing.xl, gap: spacing.xl },
});

/** Unread updates for the person signed in; none when signed out. */
function useHomeUnread(): number {
  const status = useAuthStatus();
  const unread = useUnreadCount();
  return status === 'signedIn' ? unread : 0;
}

/** The bell reads the unread count itself, so the count arriving draws only the bell. */
const HomeBell = memo(function HomeBell() {
  const { t } = useI18n();
  const nav = useNav();
  const c = useTheme().colors;
  const unreadCount = useHomeUnread();
  return (
    <View style={styles.bellWrap}>
      <IconButton
        icon="bell"
        accessibilityLabel={
          unreadCount > 0
            ? `${t('updates.title')}, ${t('ui.unread', { count: unreadCount })}`
            : t('updates.title')
        }
        onPress={() => nav.go({ name: 'updates' })}
        testID="home-bell"
      />
      {unreadCount > 0 ? (
        <View
          aria-hidden
          testID="home-bell-dot"
          pointerEvents="none"
          style={[styles.dot, { backgroundColor: c.accent }]}
        />
      ) : null}
    </View>
  );
});

export function HomeScreen() {
  const { t, l, locale } = useI18n();
  const nav = useNav();
  const c = useTheme().colors;
  const { now, openUrl } = useServices();
  const prefs = usePreferences();
  const auth = useAuthState();
  const offline = useOffline();
  const config = useAppConfig();
  const next = useNextNearYou();
  const registrations = useMyRegistrations();
  const cities = useCities();
  const areas = useAreas(prefs.cityId);
  // The same "near me" point as Nearby: the chosen area's centre, no phone location needed.
  const origin = useOrigin();
  const [showArea, setShowArea] = useState(false);
  const belowFold = useStartFrameDeferral();

  const mine = registrations.data ? nextRegisteredOccurrence(registrations.data, now()) : undefined;
  const leadingProgram = config.seasonMode === 'dora' ? 'dora' : 'circles';
  const city = cities.data?.find((x) => x.id === prefs.cityId);
  const area = areas.data?.find((x) => x.id === prefs.areaId);
  const items = next.data;
  const lead = items ? pickLeadOccurrence(items, leadingProgram) : undefined;
  const daysRead = useFeature('reading_days');
  const community = useFeature('community_today');
  const areaLabel = city
    ? area
      ? `${l(city.name).text} · ${l(area.name).text}`
      : l(city.name).text
    : t('home.area.choose');
  const name = auth.me?.displayName ?? null;
  const distanceText = (metres: number) => {
    const parts = distanceParts(metres, locale);
    return parts.unit === 'km'
      ? t('home.distance.km', { distance: parts.value })
      : t('home.distance.metres', { distance: parts.value });
  };
  const venueDistance = (venue: { lat: number; lng: number }) =>
    origin ? distanceText(haversineMetres(origin, venue)) : undefined;

  const heroSession = mine ? mine.registration.session : lead ? occurrenceAsSession(lead) : null;
  const heroDistance = heroSession ? venueDistance(heroSession.venue) : undefined;
  const readPortion = () => {
    if (!mine) return;
    const p = mine.registration.session.nextOccurrence?.portion;
    if (p?.kind === 'surah') {
      nav.tab({ name: 'quran', reader: { surah: p.surah, ayah: 1, at: now().getTime() } });
    } else if (p?.kind === 'ayah_range') {
      nav.tab({
        name: 'quran',
        reader: { surah: p.surah, ayah: p.fromAyah, at: now().getTime() },
      });
    } else {
      nav.tab({ name: 'quran' });
    }
  };
  const heroCard = mine ? (
    <View testID="home-your-next">
      <NextCircleCard
        session={mine.registration.session}
        eyebrow={t('home.nextSession.title')}
        now={now()}
        {...(heroDistance ? { distance: heroDistance } : {})}
        onPress={() => nav.go({ name: 'session', sessionId: mine.registration.sessionId })}
        onDirections={() => void openUrl(venueMapUrl(mine.registration.session.venue))}
        onReadPortion={readPortion}
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
      offline={offline}
      onJoin={() => nav.go({ name: 'register', sessionId: lead.sessionId, occurrenceId: lead.id })}
      onDirections={() => void openUrl(venueMapUrl(lead.session.venue))}
      testID="home-lead-card"
    />
  ) : null;

  const header = (
    <View testID="screen-header">
      <View style={styles.topBar}>
        <HomeBell />
        <Pressable
          role="button"
          aria-label={auth.me ? t('home.profile.open') : t('home.profile.signIn')}
          onPress={() => nav.go(auth.me ? { name: 'profile' } : { name: 'welcome' })}
          style={styles.profile}
          testID="home-profile"
        >
          <Avatar name={name ?? t('profile.guestName')} size="sm" />
        </Pressable>
      </View>
      <View style={[styles.gutter, styles.header]}>
        <Pressable
          role="button"
          aria-label={t('home.area.change', { place: areaLabel })}
          onPress={() => setShowArea(true)}
          style={styles.area}
          testID="home-area"
        >
          <Icon name="pin" size={14} color={c.textMuted} />
          <Text variant="caption" color="textMuted" decorative>
            {areaLabel}
          </Text>
          <Icon name="chevron-down" size={12} color={c.textMuted} />
        </Pressable>
        <Text variant="display" heading={1}>
          {name ? t('home.greeting', { name }) : t('home.greetingGuest')}
        </Text>
      </View>
    </View>
  );

  const nearRows = (all: NonNullable<typeof items>) => {
    const heroId = mine ? null : lead?.id;
    const rows = all.filter((o) => o.id !== heroId).slice(0, 4);
    if (rows.length === 0) return null;
    return (
      <View testID="home-near">
        {rows.map((o, i) => {
          const session = occurrenceAsSession(o);
          const title = l(session.title);
          const venue = l(session.venue.name).text;
          const when = describeWhenParts(session, t, locale, true);
          const section = t(`sections.${session.section}`);
          const distance = venueDistance(session.venue);
          const sep = t('schedule.separator');
          return (
            <TimeRow
              key={o.id}
              title={venue}
              subtitle={[when.day, section, distance].filter(Boolean).join(sep)}
              time={splitClock(when.time).clock}
              divider={i < rows.length - 1}
              accessibilityLabel={[title.text, venue, when.day, when.time, section, distance]
                .filter(Boolean)
                .join(', ')}
              onPress={() => nav.go({ name: 'session', sessionId: o.sessionId })}
              testID={`home-near-${o.id}`}
            />
          );
        })}
      </View>
    );
  };
  const rowsView = items && items.length > 0 ? nearRows(items) : null;

  return (
    <TabFrame header={header} testID="home-screen">
      <View style={[styles.gutter, styles.section]} testID="home-lead">
        <SectionHeader title={t('home.nextSession.title')} />
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
          {() =>
            heroCard ?? (
              <EmptyState
                title={t('home.nextSession.empty.title')}
                description={
                  city ? t('home.nextSession.empty.body') : t('home.nextSession.empty.bodyNoCity')
                }
                action={{
                  label: t('home.nextSession.empty.action'),
                  onPress: () => nav.tab({ name: 'nearby' }),
                }}
                testID="home-lead-empty"
              />
            )
          }
        </QueryBoundary>
      </View>

      {rowsView ? (
        <View style={[styles.gutter, styles.section]}>
          <SectionHeader
            title={t('home.nearWeek')}
            trailing={
              <IconButton
                icon="arrow-forward"
                accessibilityLabel={t('home.near.seeAll')}
                onPress={() => nav.tab({ name: 'nearby' })}
                testID="home-see-all"
              />
            }
          />
          {rowsView}
        </View>
      ) : null}

      {belowFold ? (
        <View style={[styles.gutter, styles.below]}>
          <ReadAlongCard />
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
