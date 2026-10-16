import { useState } from 'react';
import { Link } from 'react-router';
import { SESSION_STATUSES, can, type AdminSession, type SessionStatus } from '@qc/contracts';
import type { MessageKey } from '@qc/i18n';
import { useSignedIn } from '../api/auth';
import { useDirectory } from '../api/directory';
import { usePaged } from '../api/hooks';
import {
  Badge,
  DataTable,
  EmptyState,
  ErrorState,
  LoadMore,
  Loading,
  PageHeader,
  SelectField,
  type BadgeTone,
  type Column,
} from '../components/ui';
import { useI18n } from '../i18n';

export const SESSION_STATUS_KEYS = {
  draft: 'console.sessions.status.draft',
  published: 'console.sessions.status.published',
  cancelled: 'console.sessions.status.cancelled',
  archived: 'console.sessions.status.archived',
} as const satisfies Record<SessionStatus, MessageKey>;

const STATUS_TONE: Record<SessionStatus, BadgeTone> = {
  draft: 'neutral',
  published: 'success',
  cancelled: 'danger',
  archived: 'neutral',
};

export const SECTION_KEYS = {
  women: 'console.sessions.section.women',
  men: 'console.sessions.section.men',
  family: 'console.sessions.section.family',
} as const satisfies Record<AdminSession['section'], MessageKey>;

export const LANGUAGE_KEYS = {
  en: 'console.shell.language.en',
  ur: 'console.shell.language.ur',
} as const satisfies Record<AdminSession['language'], MessageKey>;

/** Sessions in the person's scope. The API filters by scope; the filters here only narrow it. */
export default function SessionsPage() {
  const { t, localized, weekday, number } = useI18n();
  const { api, principal } = useSignedIn();
  const dir = useDirectory();
  const [cityId, setCityId] = useState('');
  const [venueId, setVenueId] = useState('');
  const [status, setStatus] = useState<SessionStatus | ''>('');

  const list = usePaged(
    (cursor) =>
      api.adminSessions.list({
        query: {
          limit: 50,
          cursor,
          ...(cityId ? { cityId } : {}),
          ...(venueId ? { venueId } : {}),
          ...(status ? { status } : {}),
        },
      }),
    [api, cityId, venueId, status],
  );

  const venueOptions = dir.venues
    .filter((v) => !cityId || v.cityId === cityId)
    .map((v) => ({ value: v.id, label: dir.venueName(v.id) }));

  const when = (s: AdminSession) =>
    s.kind === 'one_off'
      ? `${s.startsOn} ${s.localStartTime}`
      : `${s.daysOfWeek.map((d) => weekday(d)).join(', ')} ${s.localStartTime}`;

  const columns: Column<AdminSession>[] = [
    { id: 'title', header: t('console.sessions.col.title'), rowHeader: true, cell: (s) => localized(s.title) },
    { id: 'venue', header: t('console.sessions.col.venue'), cell: (s) => localized(s.venue.name) },
    {
      id: 'city',
      header: t('console.sessions.col.city'),
      cell: (s) => dir.cityName(s.cityId),
    },
    {
      id: 'when',
      header: t('console.sessions.col.when'),
      cell: (s) => <bdi dir="ltr">{when(s)}</bdi>,
    },
    { id: 'section', header: t('console.sessions.col.section'), cell: (s) => t(SECTION_KEYS[s.section]) },
    { id: 'language', header: t('console.sessions.col.language'), cell: (s) => t(LANGUAGE_KEYS[s.language]) },
    {
      id: 'seats',
      header: t('console.sessions.col.seats'),
      cell: (s) =>
        s.registration.capacity === null
          ? t('console.sessions.seats.unlimited')
          : t('console.sessions.seats.of', {
              taken: number(s.registration.seatsTaken ?? 0),
              capacity: number(s.registration.capacity),
            }),
    },
    {
      id: 'status',
      header: t('console.sessions.col.status'),
      cell: (s) => <Badge tone={STATUS_TONE[s.status]}>{t(SESSION_STATUS_KEYS[s.status])}</Badge>,
    },
    {
      id: 'actions',
      header: t('console.sessions.col.actions'),
      cell: (s) =>
        can(principal, 'registration.list', { cityId: s.cityId, venueId: s.venueId }) ? (
          <Link to={`/sessions/${s.id}/registrations`}>
            {t('console.sessions.registrations')}
            <span className="sr-only"> {localized(s.title)}</span>
          </Link>
        ) : null,
    },
  ];

  return (
    <div className="page">
      <PageHeader title={t('console.sessions.title')} intro={t('console.sessions.intro')} />
      <div className="filters" role="group" aria-label={t('console.shell.filters')}>
        <SelectField
          id="filter-city"
          label={t('console.shell.filter.city')}
          value={cityId}
          placeholder={t('console.shell.filter.all')}
          onChange={(e) => {
            setCityId(e.target.value);
            setVenueId('');
          }}
          options={dir.cities.map((c) => ({ value: c.id, label: localized(c.name) }))}
        />
        <SelectField
          id="filter-venue"
          label={t('console.shell.filter.venue')}
          value={venueId}
          placeholder={t('console.shell.filter.all')}
          onChange={(e) => setVenueId(e.target.value)}
          options={venueOptions}
        />
        <SelectField
          id="filter-status"
          label={t('console.shell.filter.status')}
          value={status}
          placeholder={t('console.shell.filter.all')}
          onChange={(e) => setStatus(e.target.value as SessionStatus | '')}
          options={SESSION_STATUSES.map((s) => ({ value: s, label: t(SESSION_STATUS_KEYS[s]) }))}
        />
      </div>
      {list.status === 'loading' ? <Loading /> : null}
      {list.status === 'error' ? <ErrorState error={list.error} onRetry={list.reload} /> : null}
      {list.status === 'ready' && list.items.length === 0 ? (
        <EmptyState
          title={t('console.sessions.empty.title')}
          body={t('console.sessions.empty.body')}
        />
      ) : null}
      {list.status === 'ready' && list.items.length > 0 ? (
        <>
          <DataTable
            caption={t('console.sessions.title')}
            columns={columns}
            rows={list.items}
            rowKey={(s) => s.id}
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
