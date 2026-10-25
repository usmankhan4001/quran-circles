import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  REGISTRATION_STATUSES,
  can,
  type RegistrationStatus,
  type StaffRegistration,
} from '@qc/contracts';
import type { MessageKey } from '@qc/i18n';
import { useSignedIn } from '../api/auth';
import { usePaged, useAsync } from '../api/hooks';
import { SessionExportButton } from '../components/ExportButton';
import { SessionTabs } from '../components/SessionTabs';
import { Icon } from '../components/icons';
import { useShellSearch } from '../components/ShellFilters';
import {
  Badge,
  DataTable,
  EmptyState,
  ErrorState,
  LoadMore,
  Loading,
  NoMatch,
  PageHeader,
  Phone,
  SelectField,
  TableCard,
  type BadgeTone,
  type Column,
} from '../components/ui';
import { useI18n } from '../i18n';
import { filterBySearch } from '../lib/search';
import { SECTION_KEYS } from './SessionsPage';

export const REGISTRATION_STATUS_KEYS = {
  confirmed: 'console.exports.status.confirmed',
  waitlisted: 'console.exports.status.waitlisted',
  cancelled: 'console.exports.status.cancelled',
} as const satisfies Record<RegistrationStatus, MessageKey>;

type RegistrationTotals = { registrations: number; people: number; waitlisted: number };

const STATUS_TONE: Record<RegistrationStatus, BadgeTone> = {
  confirmed: 'success',
  waitlisted: 'warning',
  cancelled: 'neutral',
};

/** Who registered for one session. Coordinators see names and numbers; exports are audited. */
export default function RegistrationsPage() {
  const { sessionId = '' } = useParams();
  const { t, localized, dateTime, number } = useI18n();
  const { api, principal } = useSignedIn();
  const [occurrenceId, setOccurrenceId] = useState('');
  const [status, setStatus] = useState<RegistrationStatus | ''>('');
  const [query] = useShellSearch(t('console.exports.registrations.search'));

  // The public endpoint knows published sessions; a draft may be missing, and the table still works.
  const session = useAsync(
    () => api.sessions.get({ params: { sessionId } }).catch(() => null),
    [api, sessionId],
  );
  const occurrences = useAsync(
    () =>
      api.adminSessions
        .occurrences({ params: { sessionId } })
        .then((r) => r.items)
        .catch(() => []),
    [api, sessionId],
  );

  const [totals, setTotals] = useState<RegistrationTotals | null>(null);
  const list = usePaged(
    async (cursor) => {
      const page = await api.registrations.forSession({
        params: { sessionId },
        query: {
          limit: 50,
          cursor,
          ...(occurrenceId ? { occurrenceId } : {}),
          ...(status ? { status } : {}),
        },
      });
      if (cursor === undefined) setTotals(page.totals);
      return page;
    },
    [api, sessionId, occurrenceId, status],
  );

  const loaded = list.status === 'ready' ? list.items : [];
  const rows = useMemo(
    () => filterBySearch(loaded, query, (r) => [r.name, r.phone]),
    [loaded, query],
  );

  const sessionData = session.status === 'ready' ? session.data : null;
  const canExport = sessionData
    ? can(principal, 'registration.export', {
        cityId: sessionData.cityId,
        venueId: sessionData.venueId,
      })
    : true; // The API still checks; without the session we cannot know the scope here.

  // Who, their number, the section, the WhatsApp choice and the status. Joining is a pledge, so
  // the party size is not shown.
  const columns: Column<StaffRegistration>[] = [
    {
      id: 'name',
      header: t('console.registrations.col.attendee'),
      rowHeader: true,
      cell: (r) => r.name ?? t('console.exports.noName'),
    },
    {
      id: 'phone',
      header: t('console.registrations.col.phone'),
      cell: (r) => <Phone value={r.phone} />,
    },
    {
      id: 'section',
      header: t('console.registrations.col.section'),
      cell: (r) => <span className="cell-soft">{t(SECTION_KEYS[r.section])}</span>,
    },
    {
      id: 'whatsapp',
      header: t('console.registrations.col.whatsapp'),
      cell: (r) =>
        r.allowsWhatsapp ? (
          <span className="cell-ok">{t('console.registrations.whatsapp.on')}</span>
        ) : (
          <span className="cell-muted">{t('console.registrations.whatsapp.off')}</span>
        ),
    },
    {
      id: 'status',
      header: t('console.exports.col.status'),
      cell: (r) => (
        <Badge tone={STATUS_TONE[r.status]}>{t(REGISTRATION_STATUS_KEYS[r.status])}</Badge>
      ),
    },
  ];

  return (
    <div className="page">
      <PageHeader
        title={
          sessionData
            ? t('console.exports.registrations.titleFor', { session: localized(sessionData.title) })
            : t('console.exports.registrations.title')
        }
        intro={`${t('console.exports.privacy')} ${t('console.exports.audited')}`}
        hidden
      />
      <p className="back-link">
        <Link to="/sessions">{t('console.exports.registrations.back')}</Link>
      </p>
      <SessionTabs
        sessionId={sessionId}
        place={sessionData ? { cityId: sessionData.cityId, venueId: sessionData.venueId } : null}
      />
      <TableCard
        title={t('console.registrations.cardTitle')}
        subtitle={
          totals && list.status === 'ready'
            ? [
                sessionData ? localized(sessionData.venue.name) : null,
                t('console.registrations.sub', {
                  registrations: number(totals.registrations),
                }),
              ]
                .filter(Boolean)
                .join(' · ')
            : undefined
        }
        action={
          <SessionExportButton
            sessionId={sessionId}
            disabled={!canExport}
            label={t('console.registrations.export')}
          />
        }
        footer={
          <span className="privacy-note">
            <Icon name="lock-simple" size={12} weight="fill" />
            <span>{t('console.exports.registrations.sensitive')}</span>{' '}
            <span>{t('console.exports.audited')}</span>
          </span>
        }
        filtersLabel={t('console.shell.filters')}
        filters={
          <>
            <SelectField
              id="filter-occurrence"
              label={t('console.exports.filter.occurrence')}
              value={occurrenceId}
              placeholder={t('console.exports.filter.allOccurrences')}
              onChange={(e) => setOccurrenceId(e.target.value)}
              options={(occurrences.status === 'ready' ? occurrences.data : []).map((o) => ({
                value: o.id,
                label: dateTime(o.startsAt),
              }))}
            />
            <SelectField
              id="filter-registration-status"
              label={t('console.shell.filter.status')}
              value={status}
              placeholder={t('console.shell.filter.all')}
              onChange={(e) => setStatus(e.target.value as RegistrationStatus | '')}
              options={REGISTRATION_STATUSES.map((s) => ({
                value: s,
                label: t(REGISTRATION_STATUS_KEYS[s]),
              }))}
            />
          </>
        }
      >
        {list.status === 'loading' ? <Loading /> : null}
        {list.status === 'error' ? <ErrorState error={list.error} onRetry={list.reload} /> : null}
        {list.status === 'ready' && list.items.length === 0 ? (
          <EmptyState
            title={t('console.exports.registrations.empty.title')}
            body={t('console.exports.registrations.empty.body')}
          />
        ) : null}
        {list.status === 'ready' && list.items.length > 0 && rows.length === 0 ? (
          <NoMatch query={query} partial={list.hasMore} />
        ) : null}
        {list.status === 'ready' && rows.length > 0 ? (
          <DataTable
            caption={t('console.exports.registrations.title')}
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
          />
        ) : null}
        {list.status === 'ready' ? (
          <LoadMore
            hasMore={list.hasMore}
            loading={list.loadingMore}
            onLoadMore={list.loadMore}
            error={list.moreError}
          />
        ) : null}
      </TableCard>
    </div>
  );
}
