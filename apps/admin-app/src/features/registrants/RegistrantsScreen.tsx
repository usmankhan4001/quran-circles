import { useEffect, useState } from 'react';
import { View } from 'react-native';
import type { AdminOccurrence, StaffRegistration } from '@qc/contracts';
import { Button, Card, EmptyState, Select, SegmentedControl, Text, isolate, ltrRun, spacing } from '@qc/ui';
import { useQuery } from '../../api/query';
import { useT } from '../../appearance/AppearanceProvider';
import { useApi } from '../../auth/AuthProvider';
import { ErrorNotice } from '../../components/ErrorNotice';
import { QueryBoundary } from '../../components/QueryBoundary';
import { Screen } from '../../components/Screen';
import { pickLocalized } from '../../lib/localized';
import { formatPhoneDisplay, type ContactKind } from '../../lib/phone';
import { formatInstantDate, formatInstantTime, isToday, pkDayRange } from '../../lib/time';
import { useNavigation } from '../../navigation/NavigationContext';
import { sessionAbilities } from '../../scope/principal';
import { useWorkingScope } from '../../scope/WorkingScopeProvider';
import { useSession } from '../home/sessionDirectory';
import { contactUrl, openContact, type ContactOpener } from './contact';
import { useRegistrants } from './useRegistrants';

export interface RegistrantsScreenProps {
  sessionId: string;
  occurrenceId?: string;
  now?: Date;
  /** Seconds between reloads of the live list. Tests pass 0. */
  pollMs?: number;
  onContact?: ContactOpener;
}

const LIVE_POLL_MS = 30_000;

/**
 * Who is coming to a session, with one tap to call or message. The list is the coordinator's
 * working tool, so there is no export here: bulk export lives in the web console.
 */
export function RegistrantsScreen({
  sessionId,
  occurrenceId: occurrenceParam,
  now = new Date(),
  pollMs = LIVE_POLL_MS,
  onContact = openContact,
}: RegistrantsScreenProps) {
  const { t, locale } = useT();
  const api = useApi();
  const nav = useNavigation();
  const { principal } = useWorkingScope();
  const session = useSession(sessionId);
  const [occurrenceId, setOccurrenceId] = useState<string | undefined>(occurrenceParam);
  const [status, setStatus] = useState<'confirmed' | 'waitlisted'>('confirmed');

  const dates = useQuery<AdminOccurrence[]>(
    async () => {
      const res = await api.adminSessions.occurrences({
        params: { sessionId },
        query: { from: pkDayRange(now).from, limit: 14 },
      });
      return res.items;
    },
    [sessionId],
  );

  // Open on today's date when there is one, else the next.
  useEffect(() => {
    if (occurrenceId || !dates.data) return;
    const pick = dates.data.find((o) => isToday(o.startsAt, now)) ?? dates.data[0];
    if (pick) setOccurrenceId(pick.id);
  }, [dates.data, occurrenceId, now]);

  const allowed = session.data ? sessionAbilities(principal, session.data).seeRegistrants : true;
  const list = useRegistrants({
    sessionId,
    occurrenceId,
    status,
    pollMs,
    enabled: allowed && (Boolean(occurrenceParam) || dates.status !== 'loading'),
  });

  return (
    <Screen
      title={t('admin.registrants.title')}
      subtitle={session.data ? pickLocalized(session.data.title, locale) : undefined}
      onBack={nav.back}
      testID="registrants"
    >
      {!allowed ? (
        <Card variant="flat" testID="registrants-forbidden">
          <Text>{t('errors.forbidden')}</Text>
        </Card>
      ) : (
        <View style={{ gap: spacing.lg }}>
          {dates.data && dates.data.length > 0 ? (
            <Select
              testID="registrants-date"
              label={t('admin.registrants.date')}
              value={occurrenceId}
              onChange={setOccurrenceId}
              options={dates.data.map((o) => ({
                value: o.id,
                label: `${formatInstantDate(o.startsAt, locale)} · ${formatInstantTime(o.startsAt, locale)}`,
              }))}
            />
          ) : null}
          <SegmentedControl
            accessibilityLabel={t('admin.registrants.statusFilter')}
            value={status}
            onChange={setStatus}
            options={[
              { value: 'confirmed', label: t('admin.registrants.confirmed') },
              { value: 'waitlisted', label: t('admin.registrants.waitlisted') },
            ]}
          />
          <QueryBoundary query={list.query} testID="registrants-list">
            {() => (
              <View style={{ gap: spacing.md }}>
                {list.totals ? <Totals totals={list.totals} /> : null}
                {list.items.length === 0 ? (
                  <EmptyState
                    title={t('admin.registrants.emptyTitle')}
                    description={t('admin.registrants.emptyBody')}
                  />
                ) : (
                  list.items.map((r) => <RegistrantCard key={r.id} registrant={r} onContact={onContact} />)
                )}
                <ErrorNotice error={list.moreError} />
                {list.hasMore ? (
                  <Button
                    testID="registrants-more"
                    label={t('admin.registrants.more')}
                    variant="secondary"
                    fullWidth
                    loading={list.loadingMore}
                    onPress={() => void list.loadMore()}
                  />
                ) : null}
              </View>
            )}
          </QueryBoundary>
        </View>
      )}
    </Screen>
  );
}

function Totals({ totals }: { totals: { registrations: number; people: number; waitlisted: number } }) {
  const { t, n } = useT();
  const stat = (label: string, value: number, id: string) => (
    <View style={{ flex: 1, alignItems: 'center' }} key={id}>
      <Text variant="title2" align="center" testID={`registrants-total-${id}`}>
        {n(value)}
      </Text>
      <Text variant="caption" color="textSecondary" align="center">
        {label}
      </Text>
    </View>
  );
  return (
    <Card variant="flat">
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        {stat(t('admin.registrants.stat.people'), totals.people, 'people')}
        {stat(t('admin.registrants.stat.registrations'), totals.registrations, 'registrations')}
        {stat(t('admin.registrants.stat.waitlisted'), totals.waitlisted, 'waitlisted')}
      </View>
    </Card>
  );
}

function RegistrantCard({
  registrant: r,
  onContact,
}: {
  registrant: StaffRegistration;
  onContact: ContactOpener;
}) {
  const { t } = useT();
  const name = r.name ?? t('admin.registrants.noName');
  const contact = (kind: ContactKind) => {
    if (r.phone) onContact(kind, contactUrl(kind, r.phone));
  };
  return (
    <Card testID={`registrant-${r.id}`}>
      <View style={{ gap: spacing.sm }}>
        <Text variant="label">{r.name ? isolate(r.name) : name}</Text>
        <Text variant="caption" color="textSecondary">
          {t.plural('admin.registrants.party', r.partySize)} · {t(`admin.registrants.section.${r.section}`)}
          {r.status === 'waitlisted' ? ` · ${t('admin.registrants.waitlisted')}` : ''}
        </Text>
        {r.phone ? (
          <Text variant="caption" color="textSecondary" direction="ltr">
            {ltrRun(formatPhoneDisplay(r.phone))}
          </Text>
        ) : null}
        {r.phone ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <Button
              testID={`registrant-${r.id}-call`}
              label={t('admin.registrants.call')}
              variant="secondary"
              accessibilityLabel={t('admin.registrants.callName', { name })}
              onPress={() => contact('call')}
            />
            {r.allowsWhatsapp ? (
              <Button
                testID={`registrant-${r.id}-whatsapp`}
                label={t('admin.registrants.whatsapp')}
                variant="secondary"
                accessibilityLabel={t('admin.registrants.whatsappName', { name })}
                onPress={() => contact('whatsapp')}
              />
            ) : null}
          </View>
        ) : (
          <Text variant="caption" color="textSecondary">
            {t('admin.registrants.noPhone')}
          </Text>
        )}
      </View>
    </Card>
  );
}
