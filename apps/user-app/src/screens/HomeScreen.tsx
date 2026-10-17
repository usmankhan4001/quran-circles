import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Text,
  minTouchTarget,
  radii,
  spacing,
  useTheme,
} from '@qc/ui';
import { NextCircleCard } from '../components/NextCircleCard';
import { ProfileButton } from '../components/ProfileButton';
import { QueryBoundary } from '../components/QueryBoundary';
import { ScreenFrame } from '../components/ScreenFrame';
import { Section } from '../components/Section';
import { SessionCard } from '../components/SessionCard';
import { UpdateItem } from '../components/UpdateItem';
import { useAppConfig } from '../features/config/useAppConfig';
import { ayahOfTheDay } from '../features/home/ayah';
import {
  nextRegisteredOccurrence,
  pickLeadOccurrence,
  useNextNearYou,
} from '../features/home/useHome';
import { occurrenceAsSession } from '../features/home/occurrence';
import { useMyRegistrations } from '../features/journey/hooks';
import { describeOccurrence } from '../features/nearby/schedule';
import { useUnreadCount, useUpdatesFeed } from '../features/updates/hooks';
import { useI18n } from '../i18n/I18nProvider';
import { useNav } from '../nav/NavProvider';
import { useAuthState, usePreferences } from '../providers/hooks';
import { useServices } from '../providers/services';
import { useCities } from '../features/places/usePlaces';
import { GlassButton } from '../ui/GlassButton';
import { Glyph, type GlyphName } from '../ui/Glyph';
import { MapPreviewCard } from '../ui/MapPreviewCard';
import { PictureCard } from '../ui/PictureCard';
import { SearchButton } from '../ui/SearchButton';

const styles = StyleSheet.create({
  stack: { gap: spacing.xl },
  list: { gap: spacing.md },
  small: { gap: spacing.md },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  grow: { flex: 1 },
  filter: {
    width: minTouchTarget + spacing.sm,
    height: minTouchTarget + spacing.sm,
    borderRadius: radii.field,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carousel: { gap: spacing.md, paddingBottom: spacing.sm },
  picture: { width: 200 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rule: { height: 3, width: spacing.xxl, borderRadius: 2 },
  ayah: { gap: spacing.md },
  also: { flexDirection: 'row', gap: spacing.sm },
  tile: {
    flex: 1,
    minHeight: minTouchTarget + spacing.xl,
    borderRadius: radii.section,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
  },
  updatesHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});

export function HomeScreen() {
  const { t, l, locale } = useI18n();
  const nav = useNav();
  const theme = useTheme();
  const c = theme.colors;
  const { content, now } = useServices();
  const { status } = useAuthState();
  const prefs = usePreferences();
  const config = useAppConfig();
  const next = useNextNearYou();
  const registrations = useMyRegistrations();
  const unread = useUnreadCount();
  const feed = useUpdatesFeed(3);
  const cities = useCities();
  const { NextPrayerCard, ContinueReadingCard } = content;

  const mine = registrations.data ? nextRegisteredOccurrence(registrations.data, now()) : undefined;
  const leadingProgram = config.seasonMode === 'dora' ? 'dora' : 'circles';
  const otherProgram = leadingProgram === 'dora' ? 'circles' : 'dora';
  const city = cities.data?.find((x) => x.id === prefs.cityId);
  const items = next.data;
  const lead = items ? pickLeadOccurrence(items, leadingProgram) : undefined;
  const other = items?.find((o) => o.session.program === otherProgram && o.id !== lead?.id);
  const ayah = ayahOfTheDay(now());

  const heroCard = mine ? (
    <View testID="home-your-next">
      <NextCircleCard
        session={mine.registration.session}
        eyebrow={t('home.nextSession.title')}
        onPress={() => nav.go({ name: 'session', sessionId: mine.registration.sessionId })}
        testID="home-lead-card"
      />
    </View>
  ) : lead ? (
    <NextCircleCard
      session={occurrenceAsSession(lead)}
      eyebrow={t('home.nextSession.near')}
      onPress={() => nav.go({ name: 'session', sessionId: lead.sessionId })}
      testID="home-lead-card"
    />
  ) : null;

  const alsoTiles: {
    key: string;
    glyph: GlyphName;
    label: string;
    onPress: () => void;
    count?: number;
  }[] = [
    {
      key: 'quran',
      glyph: 'book',
      label: t('home.also.quran'),
      onPress: () => nav.tab({ name: 'quran' }),
    },
    {
      key: 'prayer',
      glyph: 'prayer',
      label: t('home.prayer.title'),
      onPress: () => nav.tab({ name: 'quran' }),
    },
    {
      key: 'qibla',
      glyph: 'route',
      label: t('home.also.qibla'),
      onPress: () => nav.tab({ name: 'quran' }),
    },
    {
      key: 'updates',
      glyph: 'bell',
      label: t('updates.title'),
      onPress: () => nav.go({ name: 'updates' }),
      ...(status === 'signedIn' && unread > 0 ? { count: unread } : {}),
    },
  ];

  return (
    <ScreenFrame
      title={t('tabs.home')}
      {...(city ? { subtitle: l(city.name).text } : {})}
      actions={
        <View style={styles.actions}>
          <GlassButton
            glyph="bell"
            accessibilityLabel={
              status === 'signedIn' && unread > 0
                ? `${t('updates.title')}, ${t('ui.unread', { count: unread })}`
                : t('updates.title')
            }
            count={status === 'signedIn' ? unread : 0}
            onPress={() => nav.go({ name: 'updates' })}
            testID="home-bell"
          />
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
            <Glyph name="filter" size={22} color={c.textOnAccent} />
          </Pressable>
        </View>

        {items && items.length > 0 ? (
          <MapPreviewCard
            pins={items.length}
            title={t('home.map.count', { count: items.length })}
            caption={t('home.map.open')}
            onPress={() => nav.tab({ name: 'nearby' })}
            testID="home-map"
          />
        ) : null}

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
                        return (
                          <View key={o.id} style={styles.picture}>
                            <PictureCard
                              title={title.text}
                              caption={`${l(session.venue.name).text}${t('schedule.separator')}${when}`}
                              onPress={() => nav.go({ name: 'session', sessionId: o.sessionId })}
                              testID={`home-near-${o.id}`}
                            />
                          </View>
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

        <Card testID="home-ayah">
          <View style={styles.ayah}>
            <View style={[styles.rule, { backgroundColor: c.decoration }]} aria-hidden />
            <Text variant="eyebrow" color="textSecondary">
              {t('home.ayah.title')}
            </Text>
            <Text variant="title3">
              {t('home.ayah.reference', { surah: ayah.surah, ayah: ayah.ayah })}
            </Text>
            <Button
              variant="secondary"
              label={t('home.ayah.read')}
              onPress={() =>
                nav.tab({
                  name: 'quran',
                  reader: { surah: ayah.surah, ayah: ayah.ayah, at: now().getTime() },
                })
              }
              testID="home-ayah-read"
            />
          </View>
        </Card>

        <Section title={t('home.also.title')} testID="home-also">
          <View style={styles.also}>
            {alsoTiles.map((tile) => (
              <Pressable
                key={tile.key}
                role="button"
                aria-label={
                  tile.count
                    ? `${tile.label}, ${t('ui.unread', { count: tile.count })}`
                    : tile.label
                }
                testID={`home-also-${tile.key}`}
                onPress={tile.onPress}
                style={({ pressed }) => [
                  styles.tile,
                  { backgroundColor: pressed ? c.accentSubtle : c.surface },
                  theme.mode === 'light' ? undefined : { borderWidth: 1, borderColor: c.border },
                ]}
              >
                <Glyph name={tile.glyph} size={26} color={c.accent} />
                <Text variant="caption" align="center" decorative>
                  {tile.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Section>

        <Section
          title={t('home.updates.title')}
          testID="home-updates"
          action={
            status === 'signedIn' ? (
              <View style={styles.updatesHead}>
                <Badge count={unread} testID="home-unread" />
                <Button
                  variant="tertiary"
                  label={t('home.updates.seeAll')}
                  onPress={() => nav.go({ name: 'updates' })}
                  testID="home-updates-all"
                />
              </View>
            ) : undefined
          }
        >
          {status !== 'signedIn' ? (
            <Card variant="flat">
              <View style={styles.list}>
                <Text variant="body">{t('home.updates.signedOut')}</Text>
                <Button
                  variant="secondary"
                  label={t('home.updates.signIn')}
                  onPress={() => nav.go({ name: 'signIn', returnTo: { name: 'home' } })}
                  testID="home-sign-in"
                />
              </View>
            </Card>
          ) : (
            <QueryBoundary query={feed}>
              {() =>
                feed.items.length === 0 ? (
                  <Text variant="body" color="textSecondary">
                    {t('home.updates.empty')}
                  </Text>
                ) : (
                  <View style={styles.list}>
                    {feed.items.slice(0, 3).map((update) => (
                      <UpdateItem
                        key={update.id}
                        update={update}
                        onPress={() =>
                          update.sessionId
                            ? nav.go({ name: 'session', sessionId: update.sessionId })
                            : nav.go({ name: 'updates' })
                        }
                      />
                    ))}
                  </View>
                )
              }
            </QueryBoundary>
          )}
        </Section>

        <View style={styles.small}>
          {NextPrayerCard ? (
            <NextPrayerCard onPress={() => nav.tab({ name: 'quran' })} />
          ) : (
            <Card onPress={() => nav.tab({ name: 'quran' })} testID="home-prayer-placeholder">
              <Text variant="label">{t('home.prayer.title')}</Text>
              <Text variant="caption" color="textSecondary">
                {t('home.prayer.placeholder')}
              </Text>
            </Card>
          )}
          {ContinueReadingCard ? (
            <ContinueReadingCard
              onOpen={(place) =>
                nav.tab({ name: 'quran', reader: { ...place, at: now().getTime() } })
              }
            />
          ) : (
            <Card onPress={() => nav.tab({ name: 'quran' })} testID="home-reading-placeholder">
              <Text variant="label">{t('home.reading.title')}</Text>
              <Text variant="caption" color="textSecondary">
                {t('home.reading.placeholder')}
              </Text>
            </Card>
          )}
        </View>
      </View>
    </ScreenFrame>
  );
}
