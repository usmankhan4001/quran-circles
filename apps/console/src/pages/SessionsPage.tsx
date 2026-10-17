import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { SESSION_STATUSES, can, type AdminSession, type SessionStatus } from '@qc/contracts';
import type { MessageKey } from '@qc/i18n';
import { useSignedIn } from '../api/auth';
import { useDirectory } from '../api/directory';
import { usePaged } from '../api/hooks';
import {
  AddLink,
  Badge,
  DataTable,
  EmptyState,
  ErrorState,
  LoadMore,
  Loading,
  NoMatch,
  PageHeader,
  SearchField,
  SelectField,
  StatRow,
  TableCard,
  type BadgeTone,
  type Column,
} from '../components/ui';
import { useI18n } from '../i18n';
import { sessionStats } from '../lib/kpis';
import { canSomewhere, isNavAllowed } from '../lib/permissions';
import { filterBySearch } from '../lib/search';

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
  women: 'sections.women',
  men: 'sections.men',
  family: 'sections.family',
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
  const [query, setQuery] = useState('');

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

  const loaded = list.status === 'ready' ? list.items : [];
  const stats = useMemo(() => sessionStats(loaded, Date.now()), [loaded]);
  const rows = useMemo(
    () =>
      filterBySearch(loaded, query, (s) => [
        s.title,
        s.venue.name,
        s.circle?.name,
        s.circle?.teacherName,
        dir.cityName(s.cityId),
      ]),
    [loaded, query, dir],
  );
  // Sessions are added through the bulk import; the console has no single-session form yet.
  const canAdd = isNavAllowed(principal, 'import') && canSomewhere(principal, 'session.create');

  const venueOptions = dir.venues
    .filter((v) => !cityId || v.cityId === cityId)
    .map((v) => ({ value: v.id, label: dir.venueName(v.id) }));

  const when = (s: AdminSession) =>
    s.kind === 'one_off'
      ? `${s.startsOn} ${s.localStartTime}`
      : `${s.daysOfWeek.map((d) => weekday(d)).join(', ')} ${s.localStartTime}`;

  const columns: Column<AdminSession>[] = [
    {
      id: 'title',
      header: t('console.sessions.col.title'),
      rowHeader: true,
      cell: (s) => localized(s.title),
    },
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
    {
      id: 'section',
      header: t('console.sessions.col.section'),
      cell: (s) => t(SECTION_KEYS[s.section]),
    },
    {
      id: 'language',
      header: t('console.sessions.col.language'),
      cell: (s) => t(LANGUAGE_KEYS[s.language]),
    },
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
      cell: (s) => {
        const place = { cityId: s.cityId, venueId: s.venueId };
        const registrations = can(principal, 'registration.list', place);
        const posters = can(principal, 'poster.read', place);
        if (!registrations && !posters) return null;
        return (
          <span className="row-actions">
            {registrations ? (
              <Link
                to={`/sessions/${s.id}/registrations`}
                aria-label={`${t('console.sessions.registrations')} ${localized(s.title)}`}
              >
                {t('console.sessions.registrations')}
              </Link>
            ) : null}
            {posters ? (
              <Link
                to={`/sessions/${s.id}/posters`}
                aria-label={`${t('console.posters.tabs.posters')} ${localized(s.title)}`}
              >
                {t('console.posters.tabs.posters')}
              </Link>
            ) : null}
          </span>
        );
      },
    },
  ];

  return (
    <div className="page">
      <PageHeader title={t('console.sessions.title')} intro={t('console.sessions.intro')} />
      {list.status === 'ready' ? (
        <StatRow
          label={t('console.kpi.label')}
          partial={list.hasMore}
          stats={[
            { id: 'total', label: t('console.sessions.kpi.total'), value: stats.total },
            { id: 'week', label: t('console.sessions.kpi.thisWeek'), value: stats.thisWeek },
            { id: 'full', label: t('console.sessions.kpi.full'), value: stats.full },
            {
              id: 'waiting',
              label: t('console.sessions.kpi.waiting'),
              value: stats.waitingApproval,
              tone: 'notice',
            },
          ]}
        />
      ) : null}
      <TableCard
        search={
          <SearchField
            id="sessions-search"
            label={t('console.sessions.search')}
            value={query}
            onChange={setQuery}
          />
        }
        filtersLabel={t('console.shell.filters')}
        filters={
          <>
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
              options={SESSION_STATUSES.map((s) => ({
                value: s,
                label: t(SESSION_STATUS_KEYS[s]),
              }))}
            />
          </>
        }
        action={
          canAdd ? <AddLink to="/import?kind=sessions">{t('console.sessions.add')}</AddLink> : null
        }
      >
        {list.status === 'loading' ? <Loading /> : null}
        {list.status === 'error' ? <ErrorState error={list.error} onRetry={list.reload} /> : null}
        {list.status === 'ready' && list.items.length === 0 ? (
          <EmptyState
            title={t('console.sessions.empty.title')}
            body={t('console.sessions.empty.body')}
          />
        ) : null}
        {list.status === 'ready' && list.items.length > 0 && rows.length === 0 ? (
          <NoMatch query={query} partial={list.hasMore} />
        ) : null}
        {list.status === 'ready' && rows.length > 0 ? (
          <DataTable
            caption={t('console.sessions.title')}
            columns={columns}
            rows={rows}
            rowKey={(s) => s.id}
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
