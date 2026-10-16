import { StyleSheet, View } from 'react-native';
import { Badge, Button, Card, EmptyState, Text, spacing } from '@qc/ui';
import { ProfileButton } from '../components/ProfileButton';
import { QueryBoundary } from '../components/QueryBoundary';
import { ScreenFrame } from '../components/ScreenFrame';
import { Section } from '../components/Section';
import { SessionCard } from '../components/SessionCard';
import { UpdateItem } from '../components/UpdateItem';
import { useAppConfig } from '../features/config/useAppConfig';
import {
  nextRegisteredOccurrence,
  pickLeadOccurrence,
  useNextNearYou,
} from '../features/home/useHome';
import { occurrenceAsSession } from '../features/home/occurrence';
import { useMyRegistrations } from '../features/journey/hooks';
import { useUnreadCount, useUpdatesFeed } from '../features/updates/hooks';
import { useI18n } from '../i18n/I18nProvider';
import { useNav } from '../nav/NavProvider';
import { useAuthState, usePreferences } from '../providers/hooks';
import { useServices } from '../providers/services';
import { useCities } from '../features/places/usePlaces';

const styles = StyleSheet.create({
  stack: { gap: spacing.xl },
  list: { gap: spacing.md },
  small: { gap: spacing.md },
});

export function HomeScreen() {
  const { t } = useI18n();
  const nav = useNav();
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
  const cityName = cities.data?.find((c) => c.id === prefs.cityId);

  return (
    <ScreenFrame
      title={t('tabs.home')}
      variant="large"
      actions={<ProfileButton />}
      testID="home-screen"
    >
      <View style={styles.stack}>
        {mine ? (
          <Section title={t('home.nextSession.title')} testID="home-your-next">
            <SessionCard
              session={mine.registration.session}
              emphasis="next"
              onPress={() => nav.go({ name: 'session', sessionId: mine.registration.sessionId })}
              testID="home-lead-card"
            />
          </Section>
        ) : null}

        <Section
          title={
            leadingProgram === 'dora' ? t('home.season.doraTitle') : t('home.season.circlesTitle')
          }
          testID="home-lead"
        >
          {!prefs.cityId ? (
            <Card variant="flat">
              <Text variant="body">{t('home.chooseCity')}</Text>
              <Button
                variant="secondary"
                label={t('home.chooseCity.action')}
                onPress={() => nav.tab({ name: 'nearby' })}
                testID="home-choose-city"
              />
            </Card>
          ) : null}
          <QueryBoundary query={next}>
            {(items) => {
              const lead = pickLeadOccurrence(items, leadingProgram);
              const other = items.find(
                (o) => o.session.program === otherProgram && o.id !== lead?.id,
              );
              if (!lead) {
                return (
                  <EmptyState
                    title={t('home.nextSession.empty.title')}
                    description={
                      cityName
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
              return (
                <View style={styles.list}>
                  {!mine ? (
                    <SessionCard
                      session={occurrenceAsSession(lead)}
                      emphasis="next"
                      onPress={() => nav.go({ name: 'session', sessionId: lead.sessionId })}
                      testID="home-lead-card"
                    />
                  ) : null}
                  {other ? (
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

        <Section
          title={t('home.updates.title')}
          testID="home-updates"
          action={
            status === 'signedIn' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
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
              <Text variant="body">{t('home.updates.signedOut')}</Text>
              <Button
                variant="secondary"
                label={t('home.updates.signIn')}
                onPress={() => nav.go({ name: 'signIn', returnTo: { name: 'home' } })}
                testID="home-sign-in"
              />
            </Card>
          ) : (
            <QueryBoundary query={feed}>
              {() =>
                feed.items.length === 0 ? (
                  <Text variant="body" color="textSecondary">
                    {t('home.updates.empty')}
                  </Text>
                ) : (
                  <View>
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
            <Card
              variant="flat"
              onPress={() => nav.tab({ name: 'quran' })}
              testID="home-prayer-placeholder"
            >
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
            <Card
              variant="flat"
              onPress={() => nav.tab({ name: 'quran' })}
              testID="home-reading-placeholder"
            >
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
