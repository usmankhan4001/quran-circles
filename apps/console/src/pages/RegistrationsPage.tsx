import { useState } from 'react';
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
import {
  Badge,
  Banner,
  DataTable,
  EmptyState,
  ErrorState,
  LoadMore,
  Loading,
  PageHeader,
  Phone,
  SelectField,
  type BadgeTone,
  type Column,
} from '../components/ui';
import { useI18n } from '../i18n';
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

  // The public endpoint knows published sessions; a draft may be missing, and the table still works.
  const session = useAsync(() => api.sessions.get({ params: { sessionId } }).catch(() => null), [api, sessionId]);
  const occurrences = useAsync(
    () => api.adminSessions.occurrences({ params: { sessionId } }).then((r) => r.items).catch(() => []),
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

  const sessionData = session.status === 'ready' ? session.data : null;
  const canExport = sessionData
    ? can(principal, 'registration.export', {
        cityId: sessionData.cityId,
        venueId: sessionData.venueId,
      })
    : true; // The API still checks; without the session we cannot know the scope here.

  const columns: Column<StaffRegistration>[] = [
    {
      id: 'name',
      header: t('console.exports.col.name'),
      rowHeader: true,
      cell: (r) => r.name ?? t('console.exports.noName'),
    },
    { id: 'phone', header: t('console.exports.col.phone'), cell: (r) => <Phone value={r.phone} /> },
    { id: 'section', header: t('console.exports.col.section'), cell: (r) => t(SECTION_KEYS[r.section]) },
    { id: 'party', header: t('console.exports.col.partySize'), cell: (r) => number(r.partySize) },
    {
      id: 'status',
      header: t('console.exports.col.status'),
      cell: (r) => <Badge tone={STATUS_TONE[r.status]}>{t(REGISTRATION_STATUS_KEYS[r.status])}</Badge>,
    },
    {
      id: 'whatsapp',
      header: t('console.exports.col.whatsapp'),
      cell: (r) => (r.allowsWhatsapp ? t('ui.on') : t('ui.off')),
    },
    { id: 'created', header: t('console.exports.col.registered'), cell: (r) => dateTime(r.createdAt) },
  ];

  return (
    <div className="page">
      <PageHeader
        title={
          sessionData
            ? t('console.exports.registrations.titleFor', { session: localized(sessionData.title) })
            : t('console.exports.registrations.title')
        }
        intro={t('console.exports.privacy')}
        actions={<SessionExportButton sessionId={sessionId} disabled={!canExport} />}
      />
      <p>
        <Link to="/sessions">{t('console.exports.registrations.back')}</Link>
      </p>
      <div className="filters" role="group" aria-label={t('console.shell.filters')}>
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
      </div>
      {totals && list.status === 'ready' ? (
        <dl className="stats" aria-label={t('console.exports.totals.label')}>
          <div className="stat">
            <dt className="stat-label">{t('console.exports.totals.registrations')}</dt>
            <dd className="stat-value">{number(totals.registrations)}</dd>
          </div>
          <div className="stat">
            <dt className="stat-label">{t('console.exports.totals.people')}</dt>
            <dd className="stat-value">{number(totals.people)}</dd>
          </div>
          <div className="stat">
            <dt className="stat-label">{t('console.exports.totals.waitlisted')}</dt>
            <dd className="stat-value">{number(totals.waitlisted)}</dd>
          </div>
        </dl>
      ) : null}
      {list.status === 'loading' ? <Loading /> : null}
      {list.status === 'error' ? <ErrorState error={list.error} onRetry={list.reload} /> : null}
      {list.status === 'ready' && list.items.length === 0 ? (
        <EmptyState
          title={t('console.exports.registrations.empty.title')}
          body={t('console.exports.registrations.empty.body')}
        />
      ) : null}
      {list.status === 'ready' && list.items.length > 0 ? (
        <>
          <Banner tone="info">{t('console.exports.registrations.sensitive')}</Banner>
          <DataTable
            caption={t('console.exports.registrations.title')}
            columns={columns}
            rows={list.items}
            rowKey={(r) => r.id}
          />
          <LoadMore
            hasMore={list.hasMore}
            loading={list.loadingMore}
            onLoadMore={list.loadMore}
            error={list.moreError}
          />
        </>
      ) : null}
    </div>
  );
}
