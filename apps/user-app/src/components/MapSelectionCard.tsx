import { StyleSheet, View } from 'react-native';
import type { Session } from '@qc/contracts';
import { Button, Card, QuranPortion, Text, spacing } from '@qc/ui';
import { splitClock } from '../features/home/clock';
import { useMyRegistrations } from '../features/journey/hooks';
import { describeWhenParts } from '../features/nearby/schedule';
import { registerState } from '../features/session/registerState';
import { describePortion } from '../features/session/portion';
import { useI18n } from '../i18n/I18nProvider';
import { useNav } from '../nav/NavProvider';

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  card: { gap: spacing.md },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  head: { flex: 1, gap: 2 },
  row: { flexDirection: 'row', gap: spacing.sm },
  grow: { flex: 1 },
});

/**
 * The card for the place chosen on a map: the venue, when it starts, the portion and who it is
 * for, then Join (the pledge) and Details. One card for each circle at the place. Used by Nearby
 * and by the full-screen map.
 */
export function MapSelectionCards({
  sessions,
  distanceText,
  venueId,
}: {
  sessions: readonly Session[];
  distanceText: (to: { lat: number; lng: number }) => string | undefined;
  venueId: string;
}) {
  const { t, l, locale } = useI18n();
  const nav = useNav();
  const mine = useMyRegistrations();
  const sep = t('schedule.separator');
  return (
    <View style={styles.list} testID="map-selection">
      {sessions.map((session) => {
        const title = l(session.title);
        const distance = distanceText(session.venue);
        const place = l(session.venue.name).text;
        const portion = session.nextOccurrence
          ? describePortion(session.nextOccurrence, t, locale)
          : null;
        const when = describeWhenParts(session, t, locale, true);
        const joinState = registerState(session, mine.data);
        const joined = joinState.kind === 'registered';
        return (
          <Card key={session.id} testID={`map-selected-${session.id}`}>
            <View style={styles.card}>
              <View style={styles.top}>
                <View style={styles.head}>
                  <Text variant="eyebrow" color="textAccent">
                    {when.day}
                  </Text>
                  <Text variant="title3" lang={title.lang}>
                    {place}
                  </Text>
                  <Text variant="caption" color="textMuted">
                    {[title.text, t(`sections.${session.section}`), distance]
                      .filter(Boolean)
                      .join(sep)}
                  </Text>
                </View>
                <Text variant="time" lang="en" direction="ltr">
                  {splitClock(when.time).clock}
                </Text>
              </View>
              {portion ? <QuranPortion label={portion} /> : null}
              <View style={styles.row}>
                {joinState.kind === 'open' || joined ? (
                  <View style={styles.grow}>
                    <Button
                      fullWidth
                      variant={joined ? 'secondary' : 'primary'}
                      icon="check"
                      label={joined ? t('session.joined') : t('nearby.map.selectedJoin')}
                      accessibilityLabel={`${joined ? t('session.joined') : t('session.join')}${sep}${title.text}`}
                      onPress={() => {
                        if (joined) {
                          nav.tab({ name: 'journey' });
                          return;
                        }
                        nav.go({ name: 'register', sessionId: session.id });
                      }}
                      testID={`map-join-${session.id}`}
                    />
                  </View>
                ) : null}
                <View style={styles.grow}>
                  <Button
                    fullWidth
                    variant="outline"
                    icon="info"
                    label={t('nearby.map.details')}
                    onPress={() => nav.go({ name: 'session', sessionId: session.id })}
                    testID={`map-open-${session.id}`}
                  />
                </View>
              </View>
            </View>
          </Card>
        );
      })}
      <Button
        variant="tertiary"
        fullWidth
        label={t('nearby.map.viewVenue')}
        onPress={() => nav.go({ name: 'venue', venueId })}
        testID="map-view-venue"
      />
    </View>
  );
}
