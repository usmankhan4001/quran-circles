import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, EmptyState, ListItem, Text, formatNumber, radii, spacing, useTheme } from '@qc/ui';
import type { Registration } from '@qc/contracts';
import { ConfirmSheet } from '../components/ConfirmSheet';
import { MemorisationEntryCard } from '../components/MemorisationEntryCard';
import { ProfileButton } from '../components/ProfileButton';
import { QueryBoundary } from '../components/QueryBoundary';
import { ReminderToggle } from '../components/ReminderToggle';
import { ScreenFrame } from '../components/ScreenFrame';
import { Section } from '../components/Section';
import { SessionCard } from '../components/SessionCard';
import { errorMessageKey } from '../core/errors';
import {
  useCancelRegistration,
  useFollowActions,
  useMyFollows,
  useMyRegistrations,
} from '../features/journey/hooks';
import { useI18n } from '../i18n/I18nProvider';
import { useNav } from '../nav/NavProvider';
import { useAuthState } from '../providers/hooks';
import { useToast } from '../providers/Toasts';

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xxs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.section,
  },
  stack: { gap: spacing.xl },
  list: { gap: spacing.lg },
  footer: { gap: spacing.md, marginTop: spacing.md },
});

/** The three numbers at the top of My Journey (J1), on the glass of the green header. */
function JourneySummary() {
  const { t, locale } = useI18n();
  const c = useTheme().colors;
  const registrations = useMyRegistrations();
  const follows = useMyFollows();
  const confirmed = registrations.data?.filter((r) => r.status === 'confirmed').length ?? 0;
  const waiting = registrations.data?.filter((r) => r.status === 'waitlisted').length ?? 0;
  const following = follows.data?.length ?? 0;
  const stats = [
    { key: 'upcoming', value: confirmed, label: t('journey.summary.upcoming') },
    { key: 'waiting', value: waiting, label: t('journey.summary.waiting') },
    { key: 'following', value: following, label: t('journey.summary.following') },
  ] as const;
  return (
    <View style={styles.stats} testID="journey-summary">
      {stats.map((stat) => (
        // The number and its caption are read as text ("0, Upcoming"), as one stop on a phone.
        // A name on the tile would be ignored on the web, where the tile is a plain `div`.
        <View
          key={stat.key}
          accessible
          style={[styles.stat, { backgroundColor: c.heroGlass }]}
          testID={`journey-stat-${stat.key}`}
        >
          <Text variant="title1" color="textOnHero">
            {formatNumber(stat.value, locale)}
          </Text>
          <Text variant="caption" color="textOnHero" align="center">
            {stat.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function JourneyScreen() {
  const { t } = useI18n();
  const nav = useNav();
  const { status } = useAuthState();

  return (
    <ScreenFrame
      title={t('tabs.myJourney')}
      actions={<ProfileButton />}
      {...(status === 'signedIn' ? { hero: <JourneySummary /> } : {})}
      testID="journey-screen"
    >
      {status !== 'signedIn' ? (
        <EmptyState
          title={t('journey.signIn.title')}
          description={t('journey.signIn.body')}
          action={{
            label: t('journey.signIn.action'),
            onPress: () => nav.go({ name: 'signIn', returnTo: { name: 'journey' } }),
          }}
          testID="journey-signed-out"
        />
      ) : (
        <JourneyContent />
      )}
    </ScreenFrame>
  );
}

function JourneyContent() {
  const { t, l } = useI18n();
  const nav = useNav();
  const toast = useToast();
  const registrations = useMyRegistrations();
  const follows = useMyFollows();
  const cancel = useCancelRegistration();
  const { unfollow } = useFollowActions();
  const [cancelling, setCancelling] = useState<Registration | null>(null);

  const confirmCancel = async () => {
    if (!cancelling) return;
    const done = await cancel.run(cancelling.id);
    if (done) {
      setCancelling(null);
      toast.show(t('journey.cancel.done'), 'success');
    }
  };

  return (
    <View style={styles.stack}>
      <Section title={t('journey.registrations.title')} testID="journey-registrations">
        <QueryBoundary query={registrations}>
          {(items) =>
            items.length === 0 ? (
              <EmptyState
                title={t('journey.registrations.empty.title')}
                description={t('journey.registrations.empty.body')}
                action={{
                  label: t('journey.registrations.empty.action'),
                  onPress: () => nav.tab({ name: 'nearby' }),
                }}
                testID="journey-empty"
              />
            ) : (
              <View style={styles.list}>
                {items.map((registration) => (
                  <SessionCard
                    key={registration.id}
                    session={registration.session}
                    emphasis="next"
                    onPress={() => nav.go({ name: 'session', sessionId: registration.sessionId })}
                    testID={`registration-${registration.id}`}
                    footer={
                      <View style={styles.footer}>
                        <Text
                          variant="label"
                          color={
                            registration.status === 'waitlisted' ? 'textWarning' : 'textSuccess'
                          }
                          testID={`registration-status-${registration.id}`}
                        >
                          {registration.status === 'waitlisted'
                            ? t('journey.status.waitlisted')
                            : t('journey.status.confirmed')}
                        </Text>
                        {registration.status === 'waitlisted' && registration.waitlistPosition ? (
                          <Text variant="body" color="textSecondary">
                            {t('registration.confirmation.position', {
                              count: registration.waitlistPosition,
                            })}
                          </Text>
                        ) : null}
                        {registration.status === 'confirmed' ? (
                          <ReminderToggle
                            sessionId={registration.sessionId}
                            registration={registration}
                          />
                        ) : null}
                        <Button
                          variant="tertiary"
                          label={t('journey.cancel')}
                          onPress={() => setCancelling(registration)}
                          testID={`cancel-${registration.id}`}
                        />
                      </View>
                    }
                  />
                ))}
              </View>
            )
          }
        </QueryBoundary>
      </Section>

      <Section title={t('journey.followed.title')} testID="journey-follows" card>
        <QueryBoundary query={follows}>
          {(items) =>
            items.length === 0 ? (
              <Text variant="body" color="textSecondary">
                {t('journey.followed.empty')}
              </Text>
            ) : (
              <View>
                {items.map((follow) => (
                  <ListItem
                    key={follow.id}
                    title={l(follow.name).text}
                    subtitle={
                      follow.venueId ? t('journey.follows.venue') : t('journey.follows.circle')
                    }
                    onPress={
                      follow.venueId
                        ? () => nav.go({ name: 'venue', venueId: follow.venueId! })
                        : undefined
                    }
                    trailing={
                      <Button
                        variant="tertiary"
                        label={t('journey.follows.unfollow')}
                        onPress={() => void unfollow.run(follow.id)}
                        testID={`unfollow-${follow.id}`}
                      />
                    }
                    divider
                    testID={`follow-${follow.id}`}
                  />
                ))}
              </View>
            )
          }
        </QueryBoundary>
      </Section>

      <MemorisationEntryCard />

      <ConfirmSheet
        visible={cancelling !== null}
        title={t('journey.cancel.title')}
        body={t('journey.cancel.body')}
        confirmLabel={t('journey.cancel.confirm')}
        cancelLabel={t('journey.cancel.keep')}
        destructive
        busy={cancel.running}
        {...(cancel.error ? { errorText: t(errorMessageKey(cancel.error.code)) } : {})}
        onConfirm={() => void confirmCancel()}
        onCancel={() => {
          cancel.clearError();
          setCancelling(null);
        }}
        testID="cancel-sheet"
      />
    </View>
  );
}
