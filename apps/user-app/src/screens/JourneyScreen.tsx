import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  EmptyState,
  Icon,
  Text,
  formatNumber,
  minTouchTarget,
  radii,
  spacing,
  useTheme,
} from '@qc/ui';
import type { Follow, Registration } from '@qc/contracts';
import { ConfirmSheet } from '../components/ConfirmSheet';
import { MemorisationEntryCard } from '../components/MemorisationEntryCard';
import { QueryBoundary } from '../components/QueryBoundary';
import { ReminderToggle } from '../components/ReminderToggle';
import { ScreenFrame } from '../components/ScreenFrame';
import { errorMessageKey } from '../core/errors';
import {
  useCancelRegistration,
  useFollowActions,
  useMyFollows,
  useMyRegistrations,
} from '../features/journey/hooks';
import { describeOccurrence, describeSchedule } from '../features/nearby/schedule';
import { venueMapUrl } from '../features/session/links';
import { useI18n } from '../i18n/I18nProvider';
import { useNav } from '../nav/NavProvider';
import { useAuthStatus } from '../providers/hooks';
import { useServices } from '../providers/services';
import { useToast } from '../providers/Toasts';

const styles = StyleSheet.create({
  stack: { gap: spacing.xl },
  block: { gap: spacing.sm + spacing.xxs },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  list: { gap: spacing.md },
  pass: { gap: spacing.md + spacing.xxs },
  passTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  qr: {
    padding: spacing.xs + spacing.xxs,
    borderRadius: radii.md - 2,
    borderWidth: 1,
  },
  passHead: { gap: spacing.xxs },
  strip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.sm + spacing.xxs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
  },
  buttons: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1 },
  followRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: minTouchTarget,
  },
  grow: { flex: 1 },
});

export function JourneyScreen() {
  const { t } = useI18n();
  const nav = useNav();
  const status = useAuthStatus();

  return (
    <ScreenFrame title={t('tabs.myJourney')} plain testID="journey-screen">
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

/** A section title with a quiet note at the end, as the artboard's "Followed Masjids  2". */
function BlockHead({ title, end }: { title: string; end?: ReactNode }) {
  return (
    <View style={styles.head}>
      <Text variant="label" heading={2}>
        {title}
      </Text>
      {end}
    </View>
  );
}

/** One registration as the artboard's seat pass (D17): what, where and when, the party, actions. */
function PassCard({
  registration,
  onCancel,
}: {
  registration: Registration;
  onCancel: () => void;
}) {
  const { t, l, locale } = useI18n();
  const nav = useNav();
  const { openUrl } = useServices();
  const theme = useTheme();
  const c = theme.colors;
  const s = registration.session;
  const title = l(s.title);
  const venue = l(s.venue.name);
  const when = s.nextOccurrence
    ? describeOccurrence(s.nextOccurrence, s.timezone, locale)
    : describeSchedule(s, t, locale);
  const waitlisted = registration.status === 'waitlisted';
  return (
    <Card padding="lg">
      <View style={styles.pass}>
        <View style={styles.passTop}>
          <Pressable
            role="button"
            aria-label={`${title.text}, ${venue.text}, ${when}`}
            onPress={() => nav.go({ name: 'session', sessionId: registration.sessionId })}
            testID={`registration-${registration.id}`}
            style={({ pressed }) => [
              styles.grow,
              styles.passHead,
              pressed ? { opacity: 0.7 } : null,
            ]}
          >
            <Text variant="title3" lang={title.lang}>
              {title.text}
            </Text>
            <Text variant="caption" color="textSecondary">
              <Text variant="caption" color="textSecondary" lang={venue.lang}>
                {venue.text}
              </Text>
              {' · '}
              {when}
            </Text>
            <Text
              variant="caption"
              color={waitlisted ? 'textWarning' : 'textSuccess'}
              strong
              testID={`registration-status-${registration.id}`}
            >
              {waitlisted ? t('journey.status.waitlisted') : t('journey.status.confirmed')}
            </Text>
          </Pressable>
          {/* The artboard's QR tile. There is no scannable pass yet, so it is drawn greyed. */}
          <View
            aria-hidden
            style={[
              styles.qr,
              {
                backgroundColor: c.surfaceMuted,
                borderColor: theme.mode === 'highContrast' ? c.borderStrong : c.border,
              },
            ]}
          >
            <Icon name="qr" size={28} color={c.textMuted} />
          </View>
        </View>

        <View style={[styles.strip, { backgroundColor: c.surfaceMuted }]}>
          <Text variant="caption" color="textSecondary">
            {t('journey.pass.ref', { ref: registration.id.slice(-4).toUpperCase() })}
          </Text>
          <Text variant="caption" strong>
            {t('journey.pass.party', {
              party: t('registration.confirmation.party', { count: registration.partySize }),
              section: t(`sections.${registration.section}`),
            })}
          </Text>
        </View>

        {waitlisted && registration.waitlistPosition ? (
          <Text variant="caption" color="textSecondary">
            {t('registration.confirmation.position', { count: registration.waitlistPosition })}
          </Text>
        ) : null}
        {!waitlisted ? (
          <ReminderToggle sessionId={registration.sessionId} registration={registration} />
        ) : null}

        <View style={styles.buttons}>
          <View style={styles.half}>
            <Button
              variant="outline"
              fullWidth
              icon="route"
              label={t('journey.directions')}
              onPress={() => void openUrl(venueMapUrl(s.venue))}
              testID={`directions-${registration.id}`}
            />
          </View>
          <View style={styles.half}>
            <Button
              variant="danger"
              fullWidth
              label={t('journey.cancel.short')}
              accessibilityLabel={t('journey.cancel')}
              onPress={onCancel}
              testID={`cancel-${registration.id}`}
            />
          </View>
        </View>
      </View>
    </Card>
  );
}

/** A followed masjid or circle as its own white card (D17), with the bell showing its alerts. */
function FollowCard({ follow }: { follow: Follow }) {
  const { t, l } = useI18n();
  const nav = useNav();
  const c = useTheme().colors;
  const { unfollow } = useFollowActions();
  const name = l(follow.name);
  const kind = follow.venueId ? t('journey.follows.venue') : t('journey.follows.circle');
  const alerts = follow.alertsEnabled ? t('journey.alerts.on') : t('journey.alerts.off');
  const body = (
    <>
      <Icon name={follow.venueId ? 'masjid' : 'people'} size={22} color={c.textAccent} />
      <View style={styles.grow}>
        <Text variant="label" lang={name.lang}>
          {name.text}
        </Text>
        <Text variant="caption" color="textSecondary">
          {`${kind} · ${alerts}`}
        </Text>
      </View>
    </>
  );
  return (
    <Card padding="md">
      <View style={styles.followRow}>
        {follow.venueId ? (
          <Pressable
            role="button"
            aria-label={`${name.text}, ${kind}`}
            onPress={() => nav.go({ name: 'venue', venueId: follow.venueId! })}
            testID={`follow-${follow.id}`}
            style={({ pressed }) => [
              styles.followRow,
              styles.grow,
              pressed ? { opacity: 0.7 } : null,
            ]}
          >
            {body}
          </Pressable>
        ) : (
          <View style={[styles.followRow, styles.grow]} testID={`follow-${follow.id}`}>
            {body}
          </View>
        )}
        <Icon
          name="bell"
          size={18}
          color={follow.alertsEnabled ? c.progress : c.textMuted}
          accessibilityLabel={alerts}
        />
        <Button
          variant="tertiary"
          label={t('journey.follows.unfollow')}
          onPress={() => void unfollow.run(follow.id)}
          testID={`unfollow-${follow.id}`}
        />
      </View>
    </Card>
  );
}

function JourneyContent() {
  const { t, locale } = useI18n();
  const nav = useNav();
  const toast = useToast();
  const registrations = useMyRegistrations();
  const follows = useMyFollows();
  const cancel = useCancelRegistration();
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
      <View style={styles.block} testID="journey-registrations">
        <BlockHead title={t('journey.registrations.title')} />
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
                  <PassCard
                    key={registration.id}
                    registration={registration}
                    onCancel={() => setCancelling(registration)}
                  />
                ))}
              </View>
            )
          }
        </QueryBoundary>
      </View>

      <View style={styles.block} testID="journey-follows">
        <BlockHead
          title={t('journey.followed.title')}
          end={
            follows.data && follows.data.length > 0 ? (
              <Text variant="caption" color="textSecondary" testID="journey-follow-count">
                {formatNumber(follows.data.length, locale)}
              </Text>
            ) : undefined
          }
        />
        <QueryBoundary query={follows}>
          {(items) =>
            items.length === 0 ? (
              <Text variant="body" color="textSecondary">
                {t('journey.followed.empty')}
              </Text>
            ) : (
              <View style={styles.list}>
                {items.map((follow) => (
                  <FollowCard key={follow.id} follow={follow} />
                ))}
              </View>
            )
          }
        </QueryBoundary>
      </View>

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
