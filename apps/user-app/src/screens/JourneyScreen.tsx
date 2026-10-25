import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  EmptyState,
  Icon,
  IconButton,
  ScreenHeader,
  SectionHeader,
  Tag,
  Text,
  formatNumber,
  minTouchTarget,
  spacing,
  useTheme,
} from '@qc/ui';
import type { Follow, Registration } from '@qc/contracts';
import { ConfirmSheet } from '../components/ConfirmSheet';
import { DaysReadCard } from '../components/DaysReadCard';
import { IconTile } from '../components/IconTile';
import { MemorisationEntryCard } from '../components/MemorisationEntryCard';
import { QueryBoundary } from '../components/QueryBoundary';
import { ReminderToggle } from '../components/ReminderToggle';
import { EmptyJourneyState } from '../components/StateView';
import { errorMessageKey } from '../core/errors';
import {
  useCancelRegistration,
  useFollowActions,
  useMyFollows,
  useMyRegistrations,
} from '../features/journey/hooks';
import { describeOccurrence, describeSchedule } from '../features/nearby/schedule';
import { useFeature } from '../features/reading/hooks';
import { venueMapUrl } from '../features/session/links';
import { useI18n } from '../i18n/I18nProvider';
import { useNav } from '../nav/NavProvider';
import { useAuthStatus } from '../providers/hooks';
import { useServices } from '../providers/services';
import { useToast } from '../providers/Toasts';
import { TabFrame } from '../ui/TabFrame';

const GUTTER = 20;

const styles = StyleSheet.create({
  gutter: { paddingHorizontal: GUTTER },
  stack: { gap: spacing.xl },
  block: { gap: spacing.xs },
  list: { gap: spacing.md },
  pass: { gap: spacing.md },
  passHead: { gap: spacing.xxs },
  status: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingTop: spacing.xs },
  reminder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  reminderSwitch: { flex: 1 },
  buttons: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1 },
  followRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: minTouchTarget + spacing.md,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
  },
  followMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  grow: { flex: 1 },
  bell: {
    width: minTouchTarget,
    height: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export function JourneyScreen() {
  const { t } = useI18n();
  const nav = useNav();
  const status = useAuthStatus();

  return (
    <TabFrame
      header={
        <View style={styles.gutter}>
          <ScreenHeader title={t('tabs.myJourney')} testID="screen-header" />
        </View>
      }
      testID="journey-screen"
    >
      <View style={styles.gutter}>
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
      </View>
    </TabFrame>
  );
}

/** One registration as a flat white card: what, where and when, the status, reminder, actions. */
function PassCard({
  registration,
  onCancel,
}: {
  registration: Registration;
  onCancel: () => void;
}) {
  const { t, l, locale } = useI18n();
  const nav = useNav();
  const c = useTheme().colors;
  const { openUrl } = useServices();
  const s = registration.session;
  const title = l(s.title);
  const venue = l(s.venue.name);
  const when = s.nextOccurrence
    ? describeOccurrence(s.nextOccurrence, s.timezone, locale)
    : describeSchedule(s, t, locale);
  const waitlisted = registration.status === 'waitlisted';
  const cancelled = s.status === 'cancelled';
  const section = t(`sections.${registration.section}`);
  return (
    <Card padding="lg">
      <View style={styles.pass}>
        <Pressable
          role="button"
          aria-label={`${title.text}, ${venue.text}, ${when}`}
          onPress={() => nav.go({ name: 'session', sessionId: registration.sessionId })}
          testID={`registration-${registration.id}`}
          style={({ pressed }) => [styles.passHead, pressed ? { opacity: 0.7 } : null]}
        >
          <Text variant="title3" lang={title.lang}>
            {title.text}
          </Text>
          <Text variant="caption" color="textSecondary">
            <Text variant="caption" color="textSecondary" lang={venue.lang}>
              {venue.text}
            </Text>
            {t('schedule.separator')}
            {when}
          </Text>
          {cancelled || waitlisted ? (
            <View style={styles.status}>
              <Tag
                kind={cancelled ? 'alert' : 'gilt'}
                label={cancelled ? t('journey.status.cancelled') : t('journey.status.waitlisted')}
                testID={`registration-status-${registration.id}`}
              />
              <Text variant="caption" color="textSecondary">
                {section}
              </Text>
            </View>
          ) : (
            <View style={styles.status}>
              <Icon name="check" size={16} color={c.textAccent} />
              <Text
                variant="caption"
                color="textAccent"
                strong
                testID={`registration-status-${registration.id}`}
              >
                {t('journey.status.confirmed')}
              </Text>
              <Text variant="caption" color="textAccent">
                {`${t('schedule.separator')}${section}`}
              </Text>
            </View>
          )}
        </Pressable>

        {!waitlisted && !cancelled ? (
          <View style={[styles.reminder, { borderColor: c.hairline }]}>
            <Icon name="bell" size={20} color={c.textMuted} />
            <View style={styles.reminderSwitch}>
              <ReminderToggle sessionId={registration.sessionId} registration={registration} />
            </View>
          </View>
        ) : null}

        <View style={styles.buttons}>
          <View style={styles.half}>
            <Button
              variant="secondary"
              fullWidth
              icon="pin"
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

/** A followed masjid or circle as a flat row: its icon, its name, the bell for its alerts. */
function FollowRow({ follow, last }: { follow: Follow; last: boolean }) {
  const { t, l } = useI18n();
  const nav = useNav();
  const c = useTheme().colors;
  const { unfollow, setAlerts } = useFollowActions();
  const name = l(follow.name);
  const kind = follow.venueId ? t('journey.follows.venue') : t('journey.follows.circle');
  const alerts = follow.alertsEnabled ? t('journey.alerts.on') : t('journey.alerts.off');
  const body = (
    <>
      <IconTile icon={follow.venueId ? 'masjid' : 'people'} tone="fill" />
      <View style={styles.grow}>
        <Text variant="label" lang={name.lang}>
          {name.text}
        </Text>
        <Text variant="caption" color="textSecondary">
          {kind}
        </Text>
      </View>
    </>
  );
  return (
    <View style={[styles.followRow, { borderBottomColor: last ? 'transparent' : c.hairline }]}>
      {follow.venueId ? (
        <Pressable
          role="button"
          aria-label={`${name.text}, ${kind}`}
          onPress={() => nav.go({ name: 'venue', venueId: follow.venueId! })}
          testID={`follow-${follow.id}`}
          style={({ pressed }) => [styles.followMain, pressed ? { opacity: 0.7 } : null]}
        >
          {body}
        </Pressable>
      ) : (
        <View style={styles.followMain} testID={`follow-${follow.id}`}>
          {body}
        </View>
      )}
      <Pressable
        role="button"
        aria-label={`${alerts}, ${name.text}`}
        onPress={() => void setAlerts.run(follow.id, !follow.alertsEnabled)}
        style={({ pressed }) => [styles.bell, { opacity: pressed ? 0.7 : 1 }]}
        testID={`alerts-toggle-${follow.id}`}
      >
        <Icon name="bell" size={22} color={follow.alertsEnabled ? c.textAccent : c.textMuted} />
      </Pressable>
      <IconButton
        icon="close"
        accessibilityLabel={t('journey.follows.unfollowNamed', { name: name.text })}
        onPress={() => void unfollow.run(follow.id)}
        testID={`unfollow-${follow.id}`}
      />
    </View>
  );
}

function JourneyContent() {
  const { t, locale } = useI18n();
  const nav = useNav();
  const toast = useToast();
  const registrations = useMyRegistrations();
  const follows = useMyFollows();
  const daysRead = useFeature('reading_days');
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

  // Nothing joined and nothing followed: the page is one invitation, not two empty sections.
  const blank =
    registrations.data !== undefined &&
    registrations.data.length === 0 &&
    follows.data !== undefined &&
    follows.data.length === 0;

  return (
    <View style={styles.stack}>
      {blank ? (
        <EmptyJourneyState
          onQuran={() => nav.tab({ name: 'quran' })}
          onFind={() => nav.tab({ name: 'nearby' })}
        />
      ) : (
        <>
          <View style={styles.block} testID="journey-registrations">
            <SectionHeader title={t('journey.registrations.title')} />
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
                    testID="journey-registrations-empty"
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
            <SectionHeader
              title={t('journey.followed.title')}
              trailing={
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
                  <View>
                    {items.map((follow, i) => (
                      <FollowRow key={follow.id} follow={follow} last={i === items.length - 1} />
                    ))}
                  </View>
                )
              }
            </QueryBoundary>
          </View>
        </>
      )}

      {daysRead.on ? (
        <View style={styles.block} testID="journey-reading">
          <DaysReadCard />
        </View>
      ) : null}

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
