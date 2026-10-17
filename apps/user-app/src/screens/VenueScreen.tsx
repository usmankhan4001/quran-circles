import { StyleSheet, View } from 'react-native';
import { Button, Card, Text, spacing } from '@qc/ui';
import { FacilitiesChecklist } from '../components/FacilitiesChecklist';
import { QueryBoundary } from '../components/QueryBoundary';
import { ScreenFrame } from '../components/ScreenFrame';
import { Section } from '../components/Section';
import { SessionCard } from '../components/SessionCard';
import { useRequireAuth } from '../features/auth/useRequireAuth';
import { useIsFollowing } from '../features/journey/hooks';
import { useVenue, useVenueSessions } from '../features/nearby/useSessions';
import { venueMapUrl, venuePhoneUrl } from '../features/session/links';
import { useI18n } from '../i18n/I18nProvider';
import { useNav } from '../nav/NavProvider';
import { useServices } from '../providers/services';
import { PhotoBlock } from '../ui/PhotoBlock';

const styles = StyleSheet.create({
  stack: { gap: spacing.xl },
  actions: { gap: spacing.sm },
  list: { gap: spacing.md },
});

export function VenueScreen({ venueId }: { venueId: string }) {
  const { t, l } = useI18n();
  const nav = useNav();
  const { openUrl } = useServices();
  const requireAuth = useRequireAuth();
  const venue = useVenue(venueId);
  const sessions = useVenueSessions(venueId);
  const { follow, toggle } = useIsFollowing(venueId);
  const title = venue.data ? l(venue.data.name).text : t('venue.title');

  return (
    <ScreenFrame
      title={title}
      onBack={() => nav.back()}
      hero={<PhotoBlock testID="venue-photo" />}
      testID="venue-screen"
    >
      <QueryBoundary query={venue}>
        {(v) => {
          const address = l(v.address);
          return (
            <View style={styles.stack}>
              <Card>
                <Text variant="bodyLarge" lang={address.lang}>
                  {address.text}
                </Text>
              </Card>

              <View style={styles.actions}>
                {v.contactPhone ? (
                  <Button
                    label={t('venue.call')}
                    fullWidth
                    onPress={() => void openUrl(venuePhoneUrl(v.contactPhone!))}
                    testID="venue-contact"
                  />
                ) : (
                  <Text variant="caption" color="textSecondary" testID="venue-no-phone">
                    {t('venue.noPhone')}
                  </Text>
                )}
                <Button
                  variant="secondary"
                  label={t('venue.directions')}
                  fullWidth
                  onPress={() => void openUrl(venueMapUrl(v))}
                  testID="venue-location"
                />
                <Button
                  variant="secondary"
                  label={follow ? t('venue.unfollow') : t('venue.follow')}
                  fullWidth
                  onPress={() => {
                    if (requireAuth({ name: 'venue', venueId })) void toggle();
                  }}
                  testID="venue-follow"
                />
              </View>

              <Section title={t('venue.facilities.title')} card>
                <FacilitiesChecklist facilities={v.facilities} />
              </Section>

              <Section title={t('venue.sessions.title')}>
                <QueryBoundary query={sessions}>
                  {(items) =>
                    items.length === 0 ? (
                      <Text variant="body" color="textSecondary">
                        {t('venue.sessions.empty')}
                      </Text>
                    ) : (
                      <View style={styles.list}>
                        {items.map((session) => (
                          <SessionCard
                            key={session.id}
                            session={session}
                            onPress={() => nav.go({ name: 'session', sessionId: session.id })}
                          />
                        ))}
                      </View>
                    )
                  }
                </QueryBoundary>
              </Section>
            </View>
          );
        }}
      </QueryBoundary>
    </ScreenFrame>
  );
}
