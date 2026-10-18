import { useEffect, useState } from 'react';
import { View } from 'react-native';
import type { AdminOccurrence, StaffRegistration } from '@qc/contracts';
import { Button, Card, EmptyState, Select, SearchField, Text, isolate, spacing } from '@qc/ui';
import { useQuery } from '../../api/query';
import { useT } from '../../appearance/AppearanceProvider';
import { useApi } from '../../auth/AuthProvider';
import { ErrorNotice } from '../../components/ErrorNotice';
import { NotAvailable } from '../../components/NotAvailable';
import { QueryBoundary } from '../../components/QueryBoundary';
import { FilterPills } from '../../components/FilterPills';
import { Screen } from '../../components/Screen';
import { pickLocalized } from '../../lib/localized';
import { type ContactKind } from '../../lib/phone';
import { formatInstantDate, formatInstantTime, isToday, pkDayRange } from '../../lib/time';
import { useNavigation } from '../../navigation/NavigationContext';
import { routes } from '../../navigation/routes';
import { sessionAbilities } from '../../scope/principal';
import { useWorkingScope } from '../../scope/WorkingScopeProvider';
import { sessionNotAvailable, useSession } from '../home/useSession';
import { contactUrl, openContact, type ContactOpener } from './contact';
import { useRegistrants } from './useRegistrants';

export interface RegistrantsScreenProps {
  sessionId: string;
  occurrenceId?: string;
  now?: Date;
  /** Seconds between reloads of the live list. Tests pass 0. */
  pollMs?: number;
  onContact?: ContactOpener;
  /** Shown as the Registrants tab: no back button. */
  asTab?: boolean;
}

const LIVE_POLL_MS = 30_000;

type Filter = 'all' | 'checked' | 'pending' | 'waitlisted';

/**
 * D17: who is coming to a session, with one tap to message or call. The white bar with the people
 * count, a search pill, filter pills (all, checked in, pending, waiting list) and a white card for
 * each person. Checked in comes from the attendance saved for the date. The list is the
 * coordinator's working tool, so there is no export here: bulk export lives in the web console.
 */
export function RegistrantsScreen({
  sessionId,
  occurrenceId: occurrenceParam,
  now = new Date(),
  pollMs = LIVE_POLL_MS,
  onContact = openContact,
  asTab,
}: RegistrantsScreenProps) {
  const { t, locale, n } = useT();
  const api = useApi();
  const nav = useNavigation();
  const { principal } = useWorkingScope();
  const session = useSession(sessionId);
  const [occurrenceId, setOccurrenceId] = useState<string | undefined>(occurrenceParam);
  const [filter, setFilter] = useState<Filter>('all');
  const status = filter === 'waitlisted' ? 'waitlisted' : 'confirmed';
  const [search, setSearch] = useState('');

  const dates = useQuery<AdminOccurrence[]>(async () => {
    const res = await api.adminSessions.occurrences({
      params: { sessionId },
      query: { from: pkDayRange(now).from, limit: 14 },
    });
    return res.items;
  }, [sessionId]);

  // Open on today's date when there is one, else the next.
  useEffect(() => {
    if (occurrenceId || !dates.data) return;
    const pick = dates.data.find((o) => isToday(o.startsAt, now)) ?? dates.data[0];
    if (pick) setOccurrenceId(pick.id);
  }, [dates.data, occurrenceId, now]);

  const datesSettledEmpty =
    dates.status === 'error' || (dates.status === 'success' && (dates.data?.length ?? 0) === 0);
  const notAvailable = sessionNotAvailable(session);
  const can = session.data ? sessionAbilities(principal, session.data) : null;
  const allowed = !notAvailable && (can ? can.seeRegistrants : true);
  const list = useRegistrants({
    sessionId,
    occurrenceId,
    status,
    pollMs,
    // Wait for the date to be chosen, so the first request is already for one date.
    enabled: allowed && (Boolean(occurrenceId) || datesSettledEmpty),
  });
  // Who was ticked as present on this date. Only for people who may see attendance; the list
  // works without it.
  const attendance = useQuery(
    () => api.adminAttendance.get({ params: { occurrenceId: occurrenceId! } }),
    [occurrenceId],
    { enabled: allowed && Boolean(occurrenceId) && Boolean(can?.markAttendance) },
  );
  const present = new Set(
    (attendance.data?.entries ?? [])
      .map((e) => e.registrationId)
      .filter((id): id is string => Boolean(id)),
  );
  const hasChecks = attendance.status === 'success';

  // Search narrows the people already loaded; it never asks the server for another list.
  const needle = search.trim().toLocaleLowerCase();
  const shown = list.items.filter(
    (r) =>
      (!needle || (r.name ?? '').toLocaleLowerCase().includes(needle)) &&
      (filter === 'checked' ? present.has(r.id) : filter === 'pending' ? !present.has(r.id) : true),
  );
  const chosen = dates.data?.find((o) => o.id === occurrenceId);
  const chosenIsToday = chosen ? isToday(chosen.startsAt, now) : false;
  const checkedCount = list.items.filter((r) => present.has(r.id)).length;

  return (
    <Screen
      title={t('admin.registrants.title')}
      subtitle={session.data ? pickLocalized(session.data.title, locale) : undefined}
      onBack={asTab ? undefined : nav.back}
      variant="plain"
      actions={
        list.totals ? (
          <Text testID="registrants-total-people" variant="caption" color="textAccent" strong>
            {t('admin.registrants.peopleCount', { count: n(list.totals.people) })}
          </Text>
        ) : undefined
      }
      testID="registrants"
      footer={
        allowed && occurrenceId && can?.markAttendance !== false ? (
          <Button
            testID="registrants-take-attendance"
            label={t('admin.registrants.takeAttendance')}
            icon="check"
            size="large"
            fullWidth
            onPress={() => nav.push(routes.attendance(sessionId, occurrenceId))}
          />
        ) : undefined
      }
    >
      {notAvailable ? (
        <NotAvailable testID="registrants-not-available" />
      ) : !allowed ? (
        <Card variant="flat" testID="registrants-forbidden">
          <Text>{t('errors.forbidden')}</Text>
        </Card>
      ) : (
        <View style={{ gap: spacing.md }}>
          <SearchField
            testID="registrants-search"
            accessibilityLabel={t('admin.registrants.search')}
            placeholder={t('admin.registrants.search')}
            value={search}
            onChangeText={setSearch}
          />
          <FilterPills
            testID="registrants-filter"
            accessibilityLabel={t('admin.registrants.status.label')}
            value={filter}
            onChange={setFilter}
            options={[
              {
                value: 'all',
                label: t('admin.registrants.filter.all'),
                count:
                  list.totals && status === 'confirmed' ? n(list.totals.registrations) : undefined,
              },
              ...(hasChecks
                ? ([
                    {
                      value: 'checked',
                      label: t('admin.registrants.filter.checked'),
                      count: n(checkedCount),
                    },
                    {
                      value: 'pending',
                      label: t('admin.registrants.filter.pending'),
                      count: n(list.items.length - checkedCount),
                    },
                  ] as const)
                : []),
              {
                value: 'waitlisted',
                label: t('admin.registrants.filter.waitlist'),
                count: list.totals ? n(list.totals.waitlisted) : undefined,
              },
            ]}
          />
          {/* Tonight's list needs no date picker (as drawn); another date can be chosen. */}
          {dates.data && dates.data.length > 1 && !chosenIsToday ? (
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
          <QueryBoundary query={list.query} testID="registrants-list">
            {() => (
              <View style={{ gap: spacing.md }}>
                {list.items.length === 0 ? (
                  <EmptyState
                    title={t('admin.registrants.empty.title')}
                    description={t('admin.registrants.empty.body')}
                  />
                ) : shown.length === 0 ? (
                  <Text testID="registrants-no-match" color="textSecondary">
                    {t('admin.registrants.noMatch')}
                  </Text>
                ) : (
                  shown.map((r) => (
                    <RegistrantCard key={r.id} registrant={r} onContact={onContact} />
                  ))
                )}
                <ErrorNotice error={list.moreError} />
                {list.hasMore ? (
                  <Button
                    testID="registrants-more"
                    label={t('admin.registrants.more')}
                    variant="outline"
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

function RegistrantCard({
  registrant: r,
  onContact,
}: {
  registrant: StaffRegistration;
  onContact: ContactOpener;
}) {
  const { t, n } = useT();
  const name = r.name ?? t('admin.registrants.noName');
  const contact = (kind: ContactKind) => {
    if (r.phone) onContact(kind, contactUrl(kind, r.phone));
  };
  return (
    <Card testID={`registrant-${r.id}`} padding="md">
      <View style={{ gap: spacing.sm }}>
        <View style={{ gap: spacing.xxs }}>
          <Text variant="label" strong>
            {r.name ? isolate(r.name) : name}
          </Text>
          <Text variant="caption" color="textSecondary">
            {t('admin.registrants.party', { count: n(r.partySize) })} ·{' '}
            {t(`admin.registrants.section.${r.section}`)}
            {r.status === 'waitlisted' ? ` · ${t('admin.registrants.waitlisted')}` : ''}
          </Text>
          {r.phone ? null : (
            <Text variant="caption" color="textSecondary">
              {t('admin.registrants.noPhone')}
            </Text>
          )}
        </View>
        {/* Owner decision 2026-10-17: the number is never shown. The buttons carry the name. */}
        {r.phone ? (
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {r.allowsWhatsapp ? (
              <View style={{ flex: 1 }}>
                <Button
                  testID={`registrant-${r.id}-whatsapp`}
                  label={t('admin.registrants.whatsappShort')}
                  variant="secondary"
                  fullWidth
                  accessibilityLabel={t('admin.registrants.whatsappName', { name })}
                  onPress={() => contact('whatsapp')}
                />
              </View>
            ) : null}
            <View style={{ flex: 1 }}>
              <Button
                testID={`registrant-${r.id}-call`}
                label={t('admin.registrants.call')}
                variant="outline"
                icon="phone"
                fullWidth
                accessibilityLabel={t('admin.registrants.callName', { name })}
                onPress={() => contact('call')}
              />
            </View>
          </View>
        ) : null}
      </View>
    </Card>
  );
}
