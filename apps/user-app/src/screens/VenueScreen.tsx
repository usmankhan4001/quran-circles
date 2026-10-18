import { StyleSheet, View } from 'react-native';
import { Button, Card, Tag, Text, spacing } from '@qc/ui';
import { FacilityChips } from '../components/FacilitiesChecklist';
import { QueryBoundary } from '../components/QueryBoundary';
import { ScreenFrame } from '../components/ScreenFrame';
import { useRequireAuth } from '../features/auth/useRequireAuth';
import { useIsFollowing } from '../features/journey/hooks';
import { describeSchedule } from '../features/nearby/schedule';
import { useVenue, useVenueSessions } from '../features/nearby/useSessions';
import { venueMapUrl, venuePhoneUrl } from '../features/session/links';
import { useI18n } from '../i18n/I18nProvider';
import { useNav } from '../nav/NavProvider';
import { useServices } from '../providers/services';
import { shareText } from '../platform/share';
import { useToast } from '../providers/Toasts';

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  grow: { flex: 1, gap: spacing.xxs },
  grid: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1, justifyContent: 'center' },
  card: { gap: spacing.sm },
  list: { gap: spacing.sm + spacing.xxs },
  sessionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
});

export function VenueScreen({ venueId }: { venueId: string }) {
  const { t, l, locale } = useI18n();
  const nav = useNav();
  const { openUrl } = useServices();
  const requireAuth = useRequireAuth();
  const venue = useVenue(venueId);
  const sessions = useVenueSessions(venueId);
  const { follow, toggle } = useIsFollowing(venueId);
  const title = venue.data ? l(venue.data.name).text : t('venue.title');
  const toast = useToast();
  const share = async () => {
    if (!venue.data) return;
    const shared = await shareText(`${title} ${venueMapUrl(venue.data)}`);
    if (!shared) toast.show(t('session.share.unavailable'), 'info');
  };

  return (
    <ScreenFrame
      title={title}
      onBack={() => nav.back()}
      photo={{
        seed: venueId,
        testID: 'venue-photo',
        fade: 'dark',
        bare: true,
        ...(venue.data ? { onShare: () => void share() } : {}),
      }}
      testID="venue-screen"
    >
      <QueryBoundary query={venue}>
        {(v) => {
          const name = l(v.name);
          const address = l(v.address);
          return (
            <View style={styles.stack}>
              <View style={styles.top}>
                <View style={styles.grow}>
                  <Text variant="title2" heading={1} lang={name.lang}>
                    {name.text}
                  </Text>
                  <Text variant="caption" color="textSecondary" lang={address.lang}>
                    {address.text}
                  </Text>
                </View>
                <Button
                  variant={follow ? 'emerald' : 'outline'}
                  icon={follow ? 'bell' : 'plus'}
                  label={follow ? t('venue.following') : t('venue.followShort')}
                  accessibilityLabel={follow ? t('venue.unfollow') : t('venue.follow')}
                  onPress={() => {
                    if (requireAuth({ name: 'venue', venueId })) void toggle();
                  }}
                  testID="venue-follow"
                />
              </View>

              <View style={styles.grid}>
                <View style={styles.half}>
                  <Button
                    variant="secondary"
                    icon="route"
                    label={t('venue.openMaps')}
                    fullWidth
                    onPress={() => void openUrl(venueMapUrl(v))}
                    testID="venue-location"
                  />
                </View>
                <View style={styles.half}>
                  {v.contactPhone ? (
                    <Button
                      variant="secondary"
                      icon="phone"
                      label={t('venue.callShort')}
                      accessibilityLabel={t('venue.call')}
                      fullWidth
                      onPress={() => void openUrl(venuePhoneUrl(v.contactPhone!))}
                      testID="venue-contact"
                    />
                  ) : (
                    <Text
                      variant="caption"
                      color="textSecondary"
                      align="center"
                      testID="venue-no-phone"
                    >
                      {t('venue.noPhone')}
                    </Text>
                  )}
                </View>
              </View>

              <Card padding="md">
                <View style={styles.card}>
                  <Text variant="eyebrow" color="textSecondary" heading={2}>
                    {t('venue.facilities.title')}
                  </Text>
                  <FacilityChips facilities={v.facilities} variant="badges" />
                </View>
              </Card>

              <QueryBoundary query={sessions}>
                {(items) => (
                  <View style={styles.list}>
                    <Text variant="label" heading={2}>
                      {items.length === 0
                        ? t('venue.sessions.title')
                        : t('venue.sessions.count', {
                            count: items.length,
                            venue: name.text,
                          })}
                    </Text>
                    {items.length === 0 ? (
                      <Text variant="body" color="textSecondary">
                        {t('venue.sessions.empty')}
                      </Text>
                    ) : (
                      items.map((session) => {
                        const sessionTitle = l(session.title);
                        return (
                          <Card
                            key={session.id}
                            padding="md"
                            onPress={() => nav.go({ name: 'session', sessionId: session.id })}
                            accessibilityLabel={`${sessionTitle.text}, ${t(`sections.${session.section}`)}, ${describeSchedule(session, t, locale)}`}
                            testID={`session-card-${session.id}`}
                          >
                            <View style={styles.sessionTop}>
                              <View style={styles.grow}>
                                <Text variant="label" lang={sessionTitle.lang}>
                                  {sessionTitle.text}
                                </Text>
                              </View>
                              <Tag label={t(`sections.${session.section}`)} />
                            </View>
                            <Text variant="caption" color="textSecondary">
                              {describeSchedule(session, t, locale)}
                            </Text>
                          </Card>
                        );
                      })
                    )}
                  </View>
                )}
              </QueryBoundary>
            </View>
          );
        }}
      </QueryBoundary>
    </ScreenFrame>
  );
}
