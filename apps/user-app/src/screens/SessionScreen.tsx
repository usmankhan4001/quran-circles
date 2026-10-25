import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  Banner,
  Button,
  Card,
  Icon,
  Tag,
  Text,
  initialsOf,
  minTouchTarget,
  radii,
  spacing,
  useTheme,
} from '@qc/ui';
import type { Session, Occurrence } from '@qc/contracts';
import { distanceParts, haversineMetres } from '../core/distance';
import { IconTile } from '../components/IconTile';
import { JoinHalqaSheet } from '../components/JoinHalqaSheet';
import { useOrigin } from '../features/nearby/useOrigin';
import { useAreas } from '../features/places/usePlaces';
import { FacilityChips } from '../components/FacilitiesChecklist';
import { QueryBoundary } from '../components/QueryBoundary';
import { ScreenFrame } from '../components/ScreenFrame';
import { toInstant } from '../features/home/useHome';
import { useIsFollowing } from '../features/journey/hooks';
import { describeOccurrence, describeSchedule } from '../features/nearby/schedule';
import { useSession, useSessionOccurrences, useVenue } from '../features/nearby/useSessions';
import { safeWebUrl, venueMapUrl, venuePhoneUrl } from '../features/session/links';
import { describePortion } from '../features/session/portion';
import { useI18n } from '../i18n/I18nProvider';
import { useNav } from '../nav/NavProvider';
import { useAuthStatus } from '../providers/hooks';
import { useServices } from '../providers/services';
import { shareText } from '../platform/share';
import { useToast } from '../providers/Toasts';

const styles = StyleSheet.create({
  stack: { gap: spacing.md + spacing.xxs },
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
  timingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginEnd: spacing.xs,
  },
  timingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subSchedule: {
    flexDirection: 'row',
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

/** Who the session is for and when, in a glass pill and a line over the picture (D17). */
function SessionOverline({ session }: { session: Session }) {
  const { t, locale } = useI18n();
  const c = useTheme().colors;
  const dot = (
    <Text variant="caption" color="textOnHero" strong decorative>
      {' · '}
    </Text>
  );
  return (
    <View style={styles.overline}>
      <View style={[styles.glass, { backgroundColor: c.heroGlass }]}>
        <Text variant="caption" color="textOnHero" strong>
          {t(`sections.${session.section}`)}
        </Text>
        {dot}
        <Text variant="caption" color="textOnHero" strong>
          {t(`profile.language.${session.language}`)}
        </Text>
        {dot}
        <Text variant="caption" color="textOnHero" strong>
          {t(`programs.${session.program}`)}
        </Text>
      </View>
      <View style={styles.when}>
        <Text variant="caption" color="textOnHero">
          {describeSchedule(session, t, locale)}
        </Text>
        <Text variant="caption" color="textOnHero" decorative>
          ·
        </Text>
        <Text variant="caption" color="textOnHero">
          {t('session.duration', { count: session.durationMinutes })}
        </Text>
      </View>
    </View>
  );
}

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
    <ScreenFrame
      title={session.data ? l(session.data.title).text : t('session.title')}
      onBack={() => nav.back()}
      photo={{
        seed: session.data?.venueId ?? sessionId,
        testID: 'session-photo',
        fade: 'dark',
        ...(session.data
          ? {
              onShare: () => void share(session.data!),
              overline: <SessionOverline session={session.data} />,
            }
          : {}),
      }}
      testID="session-screen"
      floatingFooter
      footer={
        session.data ? (
          <View style={styles.footerRow}>
            <View style={styles.footerMain}>
              <Button
                variant={follow ? 'secondary' : 'primary'}
                label={
                  session.data.status === 'cancelled'
                    ? t('session.cancelled')
                    : follow
                      ? t('venue.following')
                      : t('venue.follow')
                }
                icon={follow ? 'check' : 'bell'}
                size="large"
                fullWidth
                disabled={session.data.status === 'cancelled'}
                onPress={() => void handleFollowPress()}
                testID="register-button"
              />
            </View>
            <View style={styles.footerSecondary}>
              <Button
                variant="outline"
                label={t('venue.directions')}
                icon="route"
                size="large"
                fullWidth
                onPress={() => void openUrl(venueMapUrl(session.data!.venue))}
                testID="session-directions-button"
              />
            </View>
          </View>
        ) : undefined
      }
    >
      <QueryBoundary query={session}>
        {(s) => {
          const venueName = l(s.venue.name);
          const description = s.description ? l(s.description) : null;
          const circle = s.circle;
          const onlineUrl = circle?.onlineLink ? safeWebUrl(circle.onlineLink) : null;
          const hostName = circle?.teacherName ?? (circle ? l(circle.name).text : null);

          return (
            <View style={styles.stack}>
              {s.status === 'cancelled' ? (
                <Banner kind="error" title={t('session.cancelled')} testID="session-cancelled" />
              ) : null}

              {/* Timing & Next Occurrence Card */}
              {s.nextOccurrence ? (
                <Card padding="md">
                  <View style={styles.timingCard}>
                    <View style={styles.timingRow}>
                      <View style={styles.timingLeft}>
                        <View style={[styles.liveDot, { backgroundColor: c.success }]} />
                        <Text variant="title3" strong>
                          {describeOccurrence(s.nextOccurrence, s.timezone, locale)}
                        </Text>
                      </View>
                      <Tag kind="ok" label={describeSchedule(s, t, locale)} />
                    </View>
                    <View style={[styles.subSchedule, { borderTopColor: c.hairline }]}>
                      <Icon name="clock" size={14} color={c.textSecondary} />
                      <Text variant="caption" color="textSecondary">
                        {t('session.duration', { count: s.durationMinutes })}
                      </Text>
                    </View>
                  </View>
                </Card>
              ) : null}

              {/* Venue & Teacher Info Card */}
              <Card padding="md">
                <InfoRow
                  leading={<IconTile icon="masjid" />}
                  title={venueName.text}
                  titleLang={venueName.lang}
                  subtitle={venueLine(s)}
                  onPress={() => nav.go({ name: 'venue', venueId: s.venueId })}
                  testID="session-venue"
                />
                <View style={[styles.rule, { backgroundColor: c.hairline }]} />
                <InfoRow
                  leading={<Initials text={hostName ? initialsOf(hostName) : '—'} />}
                  title={hostName ?? t('session.host.unknown')}
                  {...(circle?.teacherName
                    ? { subtitle: l(circle.name).text, subtitleLang: l(circle.name).lang }
                    : { subtitle: t('session.host.inPerson') })}
                  trailing={
                    <Pressable
                      role="link"
                      aria-disabled={!onlineUrl}
                      disabled={!onlineUrl}
                      onPress={() => (onlineUrl ? void openUrl(onlineUrl) : undefined)}
                      hitSlop={spacing.sm}
                      style={styles.online}
                      testID="session-online"
                    >
                      <Text variant="caption" color={onlineUrl ? 'textAccent' : 'textMuted'} strong>
                        {t('session.online')}
                      </Text>
                      <Icon
                        name="arrow-forward"
                        size={14}
                        color={onlineUrl ? c.textAccent : c.textMuted}
                      />
                    </Pressable>
                  }
                  testID="session-circle"
                />
              </Card>

              {/* WhatsApp Notification Promise */}
              <View
                style={[
                  styles.alertCard,
                  { backgroundColor: c.successSubtle, borderColor: c.border },
                ]}
              >
                <Icon name="bell" size={20} color={c.success} />
                <View style={styles.grow}>
                  <Text variant="caption" strong>
                    {t('session.reminders.title')}
                  </Text>
                  <Text variant="caption" color="textSecondary">
                    {t('home.updates.empty')}
                  </Text>
                </View>
              </View>

              {/* Upcoming Portions & Schedule */}
              <View style={styles.block}>
                <Text variant="label" heading={2}>
                  {t('session.upcomingPortions')}
                </Text>
                <Card padding="none">
                  <View style={styles.listPad}>
                    <QueryBoundary query={occurrences}>
                      {(items) =>
                        items.length === 0 ? (
                          <View style={styles.occurrence}>
                            <Text variant="caption" color="textSecondary">
                              {t('session.noUpcoming')}
                            </Text>
                          </View>
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
                </Card>
              </View>

              {venue.data ? <FacilityChips facilities={venue.data.facilities} /> : null}

              {description ? (
                <Text variant="caption" color="textSecondary" lang={description.lang}>
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
    </ScreenFrame>
  );
}

/** Two letters of a name in a circle. */
function Initials({ text }: { text: string }) {
  const c = useTheme().colors;
  return (
    <View aria-hidden style={[styles.initials, { backgroundColor: c.warningSubtle }]}>
      <Text variant="caption" color="textOnWarningSubtle" strong>
        {text}
      </Text>
    </View>
  );
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
  const body = (
    <>
      {leading}
      <View style={styles.grow}>
        <Text variant="label" lang={titleLang}>
          {title}
        </Text>
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
