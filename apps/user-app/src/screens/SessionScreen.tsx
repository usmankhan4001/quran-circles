import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  Banner,
  Button,
  Icon,
  IconButton,
  QuranPortion,
  SectionHeader,
  Tag,
  Text,
  minTouchTarget,
  radii,
  spacing,
  useTheme,
} from '@qc/ui';
import type { Registration, Session, Occurrence } from '@qc/contracts';
import { distanceParts, haversineMetres } from '../core/distance';
import { JoinHalqaSheet } from '../components/JoinHalqaSheet';
import { useOrigin } from '../features/nearby/useOrigin';
import { useAreas } from '../features/places/usePlaces';
import { FacilityChips } from '../components/FacilitiesChecklist';
import { QueryBoundary } from '../components/QueryBoundary';
import { Page } from '../components/Page';
import { splitClock } from '../features/home/clock';
import { toInstant } from '../features/home/useHome';
import { useIsFollowing, useMyRegistrations } from '../features/journey/hooks';
import {
  describeOccurrence,
  describeSchedule,
  describeWhenParts,
} from '../features/nearby/schedule';
import { useSession, useSessionOccurrences, useVenue } from '../features/nearby/useSessions';
import { registerState } from '../features/session/registerState';
import { safeWebUrl, venueMapUrl, venuePhoneUrl } from '../features/session/links';
import { describePortion } from '../features/session/portion';
import { useI18n } from '../i18n/I18nProvider';
import { useNav } from '../nav/NavProvider';
import { useAuthStatus } from '../providers/hooks';
import { useServices } from '../providers/services';
import { shareText } from '../platform/share';
import { useToast } from '../providers/Toasts';

const styles = StyleSheet.create({
  stack: { gap: spacing.xl },
  head: { gap: spacing.xs },
  venueLink: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    minHeight: 32,
  },
  timeRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: spacing.sm },
  length: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  overline: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  glass: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xxs,
    borderRadius: radii.pill,
  },
  when: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  timingCard: { gap: spacing.xs },
  timingRow: { flexDirection: 'row', alignItems: 'center' },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginEnd: spacing.xs,
  },
  subSchedule: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.card,
    borderWidth: 1,
  },
  occurrence: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: minTouchTarget,
    paddingVertical: spacing.sm,
  },
  occurrenceWhen: { flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  block: { gap: spacing.sm },
  listPad: { paddingHorizontal: spacing.md + spacing.xxs, paddingVertical: spacing.xs },
  rule: { height: 1, marginVertical: spacing.sm },
  grow: { flex: 1 },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: minTouchTarget,
  },
  initials: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  online: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  footerMain: {
    flex: 1.8,
  },
  footerSecondary: {
    flex: 1,
  },
});

export function SessionScreen({ sessionId }: { sessionId: string }) {
  const { t, l, locale } = useI18n();
  const nav = useNav();
  const { openUrl, now } = useServices();
  const session = useSession(sessionId);
  const venue = useVenue(session.data?.venueId ?? null);
  const areas = useAreas(session.data?.venue.cityId ?? null);
  const origin = useOrigin();
  const occurrences = useSessionOccurrences(sessionId, toInstant(now()));
  const toast = useToast();
  const c = useTheme().colors;
  const [showJoinSheet, setShowJoinSheet] = useState(false);

  const { follow, toggle: toggleFollow } = useIsFollowing(session.data?.venueId ?? '');
  const status = useAuthStatus();
  const mine = useMyRegistrations();

  const share = async (s: Session) => {
    const message = t('session.share.message', {
      title: l(s.title).text,
      venue: l(s.venue.name).text,
      when: s.nextOccurrence
        ? describeOccurrence(s.nextOccurrence, s.timezone, locale)
        : describeSchedule(s, t, locale),
    });
    const shared = await shareText(`${message} ${venueMapUrl(s.venue)}`);
    if (!shared) toast.show(t('session.share.unavailable'), 'info');
  };

  /** "Area · 0.8 km" under the venue name. */
  const venueLine = (s: Session) => {
    const area = areas.data?.find((a) => a.id === s.venue.areaId);
    const parts: string[] = [];
    if (area) parts.push(l(area.name).text);
    if (origin) {
      const d = distanceParts(haversineMetres(origin, s.venue), locale);
      parts.push(
        d.unit === 'km'
          ? t('home.distance.km', { distance: d.value })
          : t('home.distance.metres', { distance: d.value }),
      );
    }
    return parts.length > 0 ? parts.join(' · ') : t('session.openVenue');
  };

  const handleFollowPress = async () => {
    if (status === 'signedIn') {
      await toggleFollow();
      toast.show(
        follow
          ? t('venue.unfollow')
          : `${t('venue.following')} ${l(session.data?.venue.name ?? { en: 'Venue', ur: null }).text}`,
        'success',
      );
    } else {
      setShowJoinSheet(true);
    }
  };

  return (
    <Page
      onBack={() => nav.back()}
      trailing={
        session.data ? (
          <IconButton
            icon="share"
            accessibilityLabel={t('session.share')}
            onPress={() => void share(session.data!)}
            testID="screen-share"
          />
        ) : undefined
      }
      testID="session-screen"
    >
      <QueryBoundary query={session}>
        {(s) => {
          const venueName = l(s.venue.name);
          const description = s.description ? l(s.description) : null;
          const circle = s.circle;
          const onlineUrl = circle?.onlineLink ? safeWebUrl(circle.onlineLink) : null;
          const hostName = circle?.teacherName ?? (circle ? l(circle.name).text : null);
          const title = l(s.title);
          const when = describeWhenParts(s, t, locale, true);
          const clock = splitClock(when.time);
          const portion = s.nextOccurrence ? describePortion(s.nextOccurrence, t, locale) : null;

          return (
            <View style={styles.stack}>
              {s.status === 'cancelled' ? (
                <Banner kind="error" title={t('session.cancelled')} testID="session-cancelled" />
              ) : null}

              <View style={styles.head}>
                <Text variant="eyebrow" color="textAccent">
                  {s.nextOccurrence
                    ? describeOccurrence(s.nextOccurrence, s.timezone, locale)
                    : describeSchedule(s, t, locale)}
                </Text>
                <Text variant="display" heading={1} lang={title.lang}>
                  {title.text}
                </Text>
                <Pressable
                  role="button"
                  aria-label={`${venueName.text}, ${venueLine(s)}`}
                  onPress={() => nav.go({ name: 'venue', venueId: s.venueId })}
                  style={styles.venueLink}
                  testID="session-venue"
                >
                  <Icon name="pin" size={16} color={c.textAccent} />
                  <Text variant="label" color="textAccent" lang={venueName.lang}>
                    {venueName.text}
                  </Text>
                  <Text variant="caption" color="textMuted">
                    {venueLine(s)}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.timeRow} testID="session-time">
                <Text variant="countdown" lang="en" direction="ltr">
                  {clock.clock}
                </Text>
                {clock.period ? (
                  <Text variant="caption" color="textMuted">
                    {clock.period}
                  </Text>
                ) : null}
                <View style={styles.length}>
                  <Icon name="clock" size={14} color={c.textMuted} />
                  <Text variant="caption" color="textMuted">
                    {t('session.duration', { count: s.durationMinutes })}
                  </Text>
                </View>
              </View>

              <View style={styles.footerRow}>
                <View style={styles.footerMain}>
                  <JoinButton
                    session={s}
                    mine={mine.data}
                    following={Boolean(follow)}
                    onJoin={() => nav.go({ name: 'register', sessionId })}
                    onJourney={() => nav.tab({ name: 'journey' })}
                    onFollow={() => void handleFollowPress()}
                  />
                </View>
                <IconButton
                  icon="route"
                  variant="tonal"
                  accessibilityLabel={t('journey.directions')}
                  onPress={() => void openUrl(venueMapUrl(s.venue))}
                  testID="session-directions-button"
                />
              </View>

              <ReminderPromise joined={joinedTo(s, mine.data)} />

              {portion ? (
                <View style={styles.block}>
                  <SectionHeader
                    title={t('session.todaysPortion')}
                    trailing={
                      <IconButton
                        icon="book"
                        accessibilityLabel={t('readAlong.open')}
                        onPress={() => nav.tab({ name: 'quran' })}
                        testID="session-read-ahead"
                      />
                    }
                  />
                  <QuranPortion label={portion} />
                </View>
              ) : null}

              <View style={styles.block}>
                <SectionHeader title={t('session.about')} />
                <InfoRow
                  leading={<Icon name="calendar" size={20} color={c.textMuted} />}
                  title={describeSchedule(s, t, locale)}
                />
                {hostName ? (
                  <InfoRow
                    leading={<Icon name="user" size={20} color={c.textMuted} />}
                    title={hostName}
                    testID="session-circle"
                  />
                ) : null}
                <InfoRow
                  leading={<Icon name="people" size={20} color={c.textMuted} />}
                  title={t(`sections.${s.section}`)}
                />
                <InfoRow
                  leading={<Icon name="translate" size={20} color={c.textMuted} />}
                  title={t(`profile.language.${s.language}`)}
                />
                {onlineUrl ? (
                  <Pressable
                    role="link"
                    aria-label={t('session.online')}
                    onPress={() => void openUrl(onlineUrl)}
                    style={styles.infoRow}
                    testID="session-online"
                  >
                    <Icon name="video-camera" size={20} color={c.textAccent} />
                    <Text variant="label" color="textAccent" style={styles.grow}>
                      {t('session.online')}
                    </Text>
                  </Pressable>
                ) : null}
              </View>

              <View style={styles.block}>
                <SectionHeader title={t('session.upcomingPortions')} />
                <QueryBoundary query={occurrences}>
                  {(items) =>
                    items.length === 0 ? (
                      <Text variant="caption" color="textMuted">
                        {t('session.noUpcoming')}
                      </Text>
                    ) : (
                      <OccurrenceRows
                        session={s}
                        items={items}
                        onSelectPortion={() => nav.tab({ name: 'quran' })}
                      />
                    )
                  }
                </QueryBoundary>
              </View>

              {venue.data ? <FacilityChips facilities={venue.data.facilities} /> : null}

              {description ? (
                <Text variant="caption" color="textMuted" lang={description.lang}>
                  {description.text}
                </Text>
              ) : null}

              {venue.data?.contactPhone ? (
                <View style={styles.actions}>
                  <Button
                    variant="outline"
                    icon="phone"
                    label={t('venue.call')}
                    onPress={() => void openUrl(venuePhoneUrl(venue.data!.contactPhone!))}
                    testID="session-contact"
                  />
                </View>
              ) : null}

              <JoinHalqaSheet
                visible={showJoinSheet}
                onClose={() => setShowJoinSheet(false)}
                venueId={s.venueId}
                venueName={venueName.text}
                circleId={s.circle?.id ?? undefined}
                circleName={circle ? l(circle.name).text : undefined}
                onSuccess={() => {
                  toast.show(`${t('venue.following')} ${venueName.text}`, 'success');
                }}
              />
            </View>
          );
        }}
      </QueryBoundary>
    </Page>
  );
}

const joinedTo = (session: Session, mine: readonly Registration[] | undefined) =>
  registerState(session, mine).kind === 'registered';

/**
 * Under the timing card: before joining, what joining brings; after joining, that the person is
 * joining and that the reminders are on. A labelled state, not colour alone (check icon, words).
 */
function ReminderPromise({ joined }: { joined: boolean }) {
  const { t } = useI18n();
  const c = useTheme().colors;
  return (
    <View
      role="status"
      testID={joined ? 'session-joined' : 'session-reminders'}
      style={[styles.alertCard, { backgroundColor: c.successSubtle, borderColor: c.border }]}
    >
      <Icon name={joined ? 'check-circle' : 'bell'} size={24} color={c.success} />
      <View style={styles.grow}>
        <Text variant="label" color="textOnSuccessSubtle">
          {joined ? t('registration.success.title') : t('session.reminders.title')}
        </Text>
        <Text variant="caption" color="textSecondary">
          {joined ? t('registration.success.body') : t('session.reminders.body')}
        </Text>
      </View>
    </View>
  );
}

/**
 * The main button. Seats are not booked: a person says they will join (a registration), and from
 * then on they get the confirmation, a reminder before each session, and word of any change or
 * cancellation. A session that takes no registrations offers Follow instead, which brings the
 * venue's notices.
 */
function JoinButton({
  session,
  mine,
  following,
  onJoin,
  onJourney,
  onFollow,
}: {
  session: Session;
  mine: readonly Registration[] | undefined;
  following: boolean;
  onJoin: () => void;
  onJourney: () => void;
  onFollow: () => void;
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
    case 'registered':
      return (
        <Button
          variant="secondary"
          label={t('session.joined')}
          icon="check-circle"
          size="large"
          fullWidth
          onPress={onJourney}
          testID="register-button"
        />
      );
    case 'open':
      return (
        <Button
          variant="emerald"
          label={t('session.join')}
          icon="calendar-check"
          size="large"
          fullWidth
          onPress={onJoin}
          testID="register-button"
        />
      );
    case 'notNeeded':
      return (
        <Button
          variant={following ? 'secondary' : 'emerald'}
          label={following ? t('venue.following') : t('venue.follow')}
          icon={following ? 'check' : 'bell'}
          size="large"
          fullWidth
          onPress={onFollow}
          testID="register-button"
        />
      );
  }
}

/** A row of the venue card: a tile, a name and a line under it, and a chevron or an action. */
function InfoRow({
  leading,
  title,
  titleLang,
  subtitle,
  subtitleLang,
  trailing,
  onPress,
  testID,
}: {
  leading: ReactNode;
  title: string;
  titleLang?: 'en' | 'ur';
  subtitle?: string;
  subtitleLang?: 'en' | 'ur';
  trailing?: ReactNode;
  onPress?: () => void;
  testID?: string;
}) {
  const c = useTheme().colors;
  const titleText = (
    <Text variant="label" lang={titleLang}>
      {title}
    </Text>
  );
  const body = (
    <>
      {leading}
      <View style={styles.grow}>
        {titleText}
        {subtitle ? (
          <Text variant="caption" color="textSecondary" lang={subtitleLang}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {onPress ? <Icon name="chevron-forward" size={16} color={c.textMuted} /> : trailing}
    </>
  );
  return onPress ? (
    <Pressable
      role="button"
      aria-label={subtitle ? `${title}, ${subtitle}` : title}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.infoRow, pressed ? { opacity: 0.7 } : null]}
    >
      {body}
    </Pressable>
  ) : (
    <View style={styles.infoRow} testID={testID}>
      {body}
    </View>
  );
}

/** The dates coming up, each with its portion as an amber pill at the end. */
function OccurrenceRows({
  session,
  items,
  onSelectPortion,
}: {
  session: Session;
  items: readonly Occurrence[];
  onSelectPortion?: () => void;
}) {
  const { t, locale } = useI18n();
  const c = useTheme().colors;
  return (
    <View>
      {items.map((occurrence, i) => {
        const portion = describePortion(occurrence, t, locale);
        const cancelled = occurrence.status === 'cancelled';
        return (
          <Pressable
            key={occurrence.id}
            accessible
            onPress={onSelectPortion}
            testID={`occurrence-${occurrence.id}`}
            style={({ pressed }) => [
              styles.occurrence,
              i < items.length - 1 ? { borderBottomWidth: 1, borderBottomColor: c.hairline } : null,
              pressed ? { opacity: 0.7 } : null,
            ]}
          >
            <View style={styles.occurrenceWhen}>
              <Text variant="label" color="textSecondary">
                {describeOccurrence(occurrence, session.timezone, locale)}
              </Text>
            </View>
            {cancelled ? (
              <Tag kind="alert" label={t('session.cancelled')} />
            ) : portion ? (
              <Tag kind="gilt" label={portion} />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
