import { StyleSheet, View } from 'react-native';
import { Button, Card, ListItem, Text, spacing } from '@qc/ui';
import type { Registration, Session } from '@qc/contracts';
import { registerState } from '../features/session/registerState';
import { FacilitiesChecklist } from '../components/FacilitiesChecklist';
import { QueryBoundary } from '../components/QueryBoundary';
import { ScreenFrame } from '../components/ScreenFrame';
import { Section } from '../components/Section';
import { useRequireAuth } from '../features/auth/useRequireAuth';
import { toInstant } from '../features/home/useHome';
import { useMyRegistrations } from '../features/journey/hooks';
import { describeOccurrence, describeSchedule } from '../features/nearby/schedule';
import { useSession, useSessionOccurrences, useVenue } from '../features/nearby/useSessions';
import { safeWebUrl, venueMapUrl, venuePhoneUrl } from '../features/session/links';
import { describePortion } from '../features/session/portion';
import { useI18n } from '../i18n/I18nProvider';
import { useNav } from '../nav/NavProvider';
import { useServices } from '../providers/services';

const styles = StyleSheet.create({
  stack: { gap: spacing.xl },
  facts: { gap: spacing.xs },
  actions: { gap: spacing.sm },
});

export function SessionScreen({ sessionId }: { sessionId: string }) {
  const { t, l, locale } = useI18n();
  const nav = useNav();
  const { openUrl, now } = useServices();
  const requireAuth = useRequireAuth();
  const session = useSession(sessionId);
  const venue = useVenue(session.data?.venueId ?? null);
  const occurrences = useSessionOccurrences(sessionId, toInstant(now()));
  const mine = useMyRegistrations();

  return (
    <ScreenFrame
      title={session.data ? l(session.data.title).text : t('session.title')}
      onBack={() => nav.back()}
      testID="session-screen"
      footer={
        session.data ? (
          <RegisterFooter
            session={session.data}
            mine={mine.data}
            onRegister={() => {
              const target = { name: 'register', sessionId } as const;
              if (requireAuth(target)) nav.go(target);
            }}
            onJourney={() => nav.tab({ name: 'journey' })}
          />
        ) : undefined
      }
    >
      <QueryBoundary query={session}>
        {(s) => {
          const venueName = l(s.venue.name);
          const description = s.description ? l(s.description) : null;
          const circle = s.circle;
          const onlineUrl = circle?.onlineLink ? safeWebUrl(circle.onlineLink) : null;
          return (
            <View style={styles.stack}>
              <Card variant="flat">
                <View style={styles.facts}>
                  <Text variant="bodyLarge">{describeSchedule(s, t, locale)}</Text>
                  <Text variant="body" color="textSecondary">
                    {t('session.duration', { count: s.durationMinutes })}
                  </Text>
                  <Text variant="body" color="textSecondary">
                    {[
                      t(`sections.${s.section}`),
                      t(`profile.language.${s.language}`),
                      t(`programs.${s.program}`),
                    ].join(t('schedule.separator'))}
                  </Text>
                  {s.status === 'cancelled' ? (
                    <Text variant="body" color="textDanger" strong>
                      {t('session.cancelled')}
                    </Text>
                  ) : null}
                </View>
              </Card>

              {description ? (
                <Text variant="body" lang={description.lang}>
                  {description.text}
                </Text>
              ) : null}

              <ListItem
                title={venueName.text}
                subtitle={t('session.openVenue')}
                onPress={() => nav.go({ name: 'venue', venueId: s.venueId })}
                testID="session-venue"
              />

              {circle ? (
                <Section title={t('session.circle')}>
                  <Text variant="body" lang={l(circle.name).lang}>
                    {l(circle.name).text}
                  </Text>
                  {circle.teacherName ? (
                    <Text variant="body" color="textSecondary">
                      {t('session.teacher', { name: circle.teacherName })}
                    </Text>
                  ) : null}
                  {onlineUrl ? (
                    <Button
                      variant="secondary"
                      fullWidth
                      label={t('session.online')}
                      onPress={() => void openUrl(onlineUrl)}
                    />
                  ) : null}
                </Section>
              ) : null}

              <Section title={t('session.registration')}>
                <Text variant="body" testID="session-registration-info">
                  {!s.registration.enabled
                    ? t('session.registration.notNeeded')
                    : s.registration.capacity !== null && s.registration.seatsTaken !== null
                      ? s.registration.full
                        ? t('session.registration.fullWaitlist')
                        : t('session.seatsLeft', {
                            count: Math.max(0, s.registration.capacity - s.registration.seatsTaken),
                          })
                      : t('session.registration.open')}
                </Text>
              </Section>

              <Section title={t('session.upcoming')}>
                <QueryBoundary query={occurrences}>
                  {(items) =>
                    items.length === 0 ? (
                      <Text variant="body" color="textSecondary">
                        {t('session.noUpcoming')}
                      </Text>
                    ) : (
                      <View>
                        {items.map((occurrence) => {
                          const portion = describePortion(occurrence, t, locale);
                          return (
                            <ListItem
                              key={occurrence.id}
                              title={describeOccurrence(occurrence, s.timezone, locale)}
                              subtitle={
                                occurrence.status === 'cancelled'
                                  ? t('session.cancelled')
                                  : (portion ?? undefined)
                              }
                              chevron={false}
                              divider
                              testID={`occurrence-${occurrence.id}`}
                            />
                          );
                        })}
                      </View>
                    )
                  }
                </QueryBoundary>
              </Section>

              {venue.data ? (
                <Section title={t('venue.facilities.title')}>
                  <FacilitiesChecklist facilities={venue.data.facilities} />
                </Section>
              ) : null}

              <View style={styles.actions}>
                {venue.data?.contactPhone ? (
                  <Button
                    variant="secondary"
                    fullWidth
                    label={t('venue.call')}
                    onPress={() => void openUrl(venuePhoneUrl(venue.data!.contactPhone!))}
                    testID="session-contact"
                  />
                ) : null}
                {venue.data ? (
                  <Button
                    variant="secondary"
                    fullWidth
                    label={t('venue.directions')}
                    onPress={() => void openUrl(venueMapUrl(venue.data!))}
                    testID="session-location"
                  />
                ) : null}
              </View>
            </View>
          );
        }}
      </QueryBoundary>
    </ScreenFrame>
  );
}

function RegisterFooter({
  session,
  mine,
  onRegister,
  onJourney,
}: {
  session: Session;
  mine: readonly Registration[] | undefined;
  onRegister: () => void;
  onJourney: () => void;
}) {
  const { t } = useI18n();
  const state = registerState(session, mine);
  switch (state.kind) {
    case 'cancelled':
      return (
        <Button
          label={t('session.cancelled')}
          size="large"
          fullWidth
          disabled
          testID="register-button"
        />
      );
    case 'notNeeded':
      return (
        <Text variant="body" color="textSecondary" align="center" testID="register-not-needed">
          {t('session.registration.notNeeded')}
        </Text>
      );
    case 'registered':
      return (
        <Button
          variant="secondary"
          size="large"
          fullWidth
          label={
            state.registration.status === 'waitlisted'
              ? t('session.onWaitlist')
              : t('session.alreadyRegistered')
          }
          onPress={onJourney}
          testID="register-button"
        />
      );
    case 'waitlist':
      return (
        <Button
          label={t('session.waitlist')}
          size="large"
          fullWidth
          onPress={onRegister}
          testID="register-button"
        />
      );
    case 'open':
      return (
        <Button
          label={t('session.register')}
          size="large"
          fullWidth
          onPress={onRegister}
          testID="register-button"
        />
      );
  }
}
