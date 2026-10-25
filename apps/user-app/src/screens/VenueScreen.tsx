import { Pressable, StyleSheet, View } from 'react-native';
import {
  Icon,
  IconButton,
  MapPin,
  SectionHeader,
  Text,
  TimeRow,
  radii,
  spacing,
  useTheme,
  type IconName,
} from '@qc/ui';
import { FacilityChips } from '../components/FacilitiesChecklist';
import { Page } from '../components/Page';
import { QueryBoundary } from '../components/QueryBoundary';
import { useRequireAuth } from '../features/auth/useRequireAuth';
import { splitClock } from '../features/home/clock';
import { useIsFollowing } from '../features/journey/hooks';
import { describeWhenParts } from '../features/nearby/schedule';
import { useVenue, useVenueSessions } from '../features/nearby/useSessions';
import { venueMapUrl, venuePhoneUrl } from '../features/session/links';
import { useI18n } from '../i18n/I18nProvider';
import { useNav } from '../nav/NavProvider';
import { useServices } from '../providers/services';
import { shareText } from '../platform/share';
import { useToast } from '../providers/Toasts';

const styles = StyleSheet.create({
  stack: { gap: spacing.xl },
  head: { gap: spacing.xs },
  map: {
    height: 150,
    borderRadius: radii.card,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: {
    flex: 1,
    minHeight: 64,
    borderRadius: radii.control,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    padding: 6,
  },
  alerts: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  section: { gap: spacing.xs },
});

/** One of the three tiles under the map: an icon with its word below. */
function ActionTile({
  icon,
  label,
  accessibilityLabel,
  primary,
  onPress,
  testID,
}: {
  icon: IconName;
  label: string;
  accessibilityLabel?: string;
  primary?: boolean;
  onPress: () => void;
  testID: string;
}) {
  const c = useTheme().colors;
  return (
    <Pressable
      role="button"
      aria-label={accessibilityLabel ?? label}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.action,
        {
          backgroundColor: primary
            ? pressed
              ? c.accentPressed
              : c.accent
            : pressed
              ? c.border
              : c.surfaceMuted,
        },
      ]}
    >
      <Icon name={icon} size={22} color={primary ? c.textOnAccent : c.text} />
      <Text variant="caption" color={primary ? 'textOnAccent' : 'text'} decorative>
        {label}
      </Text>
    </Pressable>
  );
}

export function VenueScreen({ venueId }: { venueId: string }) {
  const { t, l, locale } = useI18n();
  const nav = useNav();
  const c = useTheme().colors;
  const { openUrl } = useServices();
  const requireAuth = useRequireAuth();
  const venue = useVenue(venueId);
  const sessions = useVenueSessions(venueId);
  const { follow, toggle } = useIsFollowing(venueId);
  const toast = useToast();
  const title = venue.data ? l(venue.data.name).text : t('venue.title');
  const share = async () => {
    if (!venue.data) return;
    const shared = await shareText(`${title} ${venueMapUrl(venue.data)}`);
    if (!shared) toast.show(t('session.share.unavailable'), 'info');
  };

  return (
    <Page
      onBack={() => nav.back()}
      trailing={
        venue.data ? (
          <IconButton
            icon="share"
            accessibilityLabel={t('session.share')}
            onPress={() => void share()}
            testID="screen-share"
          />
        ) : undefined
      }
      testID="venue-screen"
    >
      <QueryBoundary query={venue}>
        {(v) => {
          const name = l(v.name);
          const address = l(v.address);
          return (
            <View style={styles.stack}>
              <View style={styles.head}>
                <Text variant="display" heading={1} lang={name.lang}>
                  {name.text}
                </Text>
                <Text variant="caption" color="textMuted" lang={address.lang}>
                  {address.text}
                </Text>
              </View>

              <Pressable
                role="button"
                aria-label={t('venue.map.label', { venue: name.text })}
                onPress={() => nav.go({ name: 'map', venueId })}
                testID="venue-map-card"
                style={[styles.map, { backgroundColor: c.surfaceMuted, borderColor: c.hairline }]}
              >
                <MapPin time={name.text} selected />
              </Pressable>

              <View style={styles.actions}>
                <ActionTile
                  icon="pin"
                  label={t('venue.mapsShort')}
                  accessibilityLabel={t('venue.openMaps')}
                  onPress={() => void openUrl(venueMapUrl(v))}
                  testID="venue-location"
                />
                {v.contactPhone ? (
                  <ActionTile
                    icon="phone"
                    label={t('venue.callShort')}
                    accessibilityLabel={t('venue.call')}
                    onPress={() => void openUrl(venuePhoneUrl(v.contactPhone!))}
                    testID="venue-contact"
                  />
                ) : null}
                <ActionTile
                  icon="bell"
                  primary
                  label={follow ? t('venue.following') : t('venue.followShort')}
                  accessibilityLabel={follow ? t('venue.unfollow') : t('venue.follow')}
                  onPress={() => {
                    if (requireAuth({ name: 'venue', venueId })) void toggle();
                  }}
                  testID="venue-follow"
                />
              </View>
              {!v.contactPhone ? (
                <Text variant="caption" color="textMuted" testID="venue-no-phone">
                  {t('venue.noPhone')}
                </Text>
              ) : null}
              <View style={styles.alerts}>
                <Icon name="bell" size={14} color={c.textMuted} />
                <Text variant="caption" color="textMuted">
                  {t('venue.alerts')}
                </Text>
              </View>

              <QueryBoundary query={sessions}>
                {(items) => (
                  <View style={styles.section}>
                    <SectionHeader
                      title={t('venue.sessions.title')}
                      trailing={
                        <Text variant="caption" color="textMuted">
                          {items.length}
                        </Text>
                      }
                    />
                    {items.length === 0 ? (
                      <Text variant="body" color="textMuted">
                        {t('venue.sessions.empty')}
                      </Text>
                    ) : (
                      items.map((session, i) => {
                        const sessionTitle = l(session.title);
                        const when = describeWhenParts(session, t, locale, false);
                        return (
                          <TimeRow
                            key={session.id}
                            title={sessionTitle.text}
                            subtitle={[when.day, t(`sections.${session.section}`)].join(
                              t('schedule.separator'),
                            )}
                            time={splitClock(when.time).clock}
                            divider={i < items.length - 1}
                            onPress={() => nav.go({ name: 'session', sessionId: session.id })}
                            testID={`session-card-${session.id}`}
                          />
                        );
                      })
                    )}
                  </View>
                )}
              </QueryBoundary>

              <View style={styles.section}>
                <SectionHeader title={t('venue.facilities.title')} />
                <FacilityChips facilities={v.facilities} variant="badges" />
              </View>
            </View>
          );
        }}
      </QueryBoundary>
    </Page>
  );
}
