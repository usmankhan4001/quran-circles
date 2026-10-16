import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, EmptyState, ListItem, Text, spacing } from '@qc/ui';
import type { Registration } from '@qc/contracts';
import { ConfirmSheet } from '../components/ConfirmSheet';
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
  stack: { gap: spacing.xl },
  list: { gap: spacing.lg },
  footer: { gap: spacing.md, marginTop: spacing.md },
});

export function JourneyScreen() {
  const { t } = useI18n();
  const nav = useNav();
  const { status } = useAuthState();

  return (
    <ScreenFrame
      title={t('tabs.myJourney')}
      variant="large"
      actions={<ProfileButton />}
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

      <Section title={t('journey.followed.title')} testID="journey-follows">
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
