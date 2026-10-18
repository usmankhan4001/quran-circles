import { useMemo, useState } from 'react';
import type { AuditEntry } from '@qc/contracts';
import { useSignedIn } from '../api/auth';
import { useDirectory } from '../api/directory';
import { usePaged } from '../api/hooks';
import {
  Code,
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
  TextField,
  type Column,
} from '../components/ui';
import { useI18n } from '../i18n';
import { auditStats } from '../lib/kpis';
import { filterBySearch } from '../lib/search';

/** Start of a Pakistan-time day, as a UTC instant the API accepts. */
export function dayStartUtc(date: string): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;
  const d = new Date(`${date}T00:00:00+05:00`);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** The end of that day: the start of the next one. */
export function dayEndUtc(date: string): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;
  const d = new Date(`${date}T00:00:00+05:00`);
  if (Number.isNaN(d.getTime())) return undefined;
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** Who did what, within the person's scope. Rows name actions and records, not personal data. */
export default function AuditPage() {
  const { t, localized, dateTime } = useI18n();
  const { api } = useSignedIn();
  const dir = useDirectory();
  const [cityId, setCityId] = useState('');
  const [venueId, setVenueId] = useState('');
  const [entityType, setEntityType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [query, setQuery] = useState('');

  const fromUtc = dayStartUtc(from);
  const toUtc = dayEndUtc(to);
  const list = usePaged(
    (cursor) =>
      api.adminAudit.list({
        query: {
          limit: 50,
          cursor,
          ...(cityId ? { cityId } : {}),
          ...(venueId ? { venueId } : {}),
          ...(entityType.trim() ? { entityType: entityType.trim() } : {}),
          ...(fromUtc ? { from: fromUtc } : {}),
          ...(toUtc ? { to: toUtc } : {}),
        },
      }),
    [api, cityId, venueId, entityType, fromUtc, toUtc],
  );

  const venueOptions = dir.venues
    .filter((v) => !cityId || v.cityId === cityId)
    .map((v) => ({ value: v.id, label: dir.venueName(v.id) }));

  const loaded = list.status === 'ready' ? list.items : [];
  const stats = useMemo(() => auditStats(loaded), [loaded]);
  const rows = useMemo(
    () =>
      filterBySearch(loaded, query, (e) => [
        e.actorName,
        e.action,
        e.entityType,
        e.entityId,
        dir.venueName(e.venueId),
        dir.cityName(e.cityId),
      ]),
    [loaded, query, dir],
  );

  const columns: Column<AuditEntry>[] = [
    {
      id: 'when',
      header: t('console.audit.col.when'),
      rowHeader: true,
      cell: (e) => dateTime(e.createdAt),
    },
    {
      id: 'who',
      header: t('console.audit.col.who'),
      cell: (e) => e.actorName ?? t('console.audit.system'),
    },
    { id: 'action', header: t('console.audit.col.action'), cell: (e) => <Code>{e.action}</Code> },
    {
      id: 'record',
      header: t('console.audit.col.record'),
      cell: (e) => (
        <>
          <Code>{e.entityType}</Code>
          {e.entityId ? (
            <>
              {' '}
              <Code>{e.entityId}</Code>
            </>
          ) : null}
        </>
      ),
    },
    {
      id: 'scope',
      header: t('console.audit.col.scope'),
      cell: (e) =>
        e.venueId
          ? dir.venueName(e.venueId)
          : e.cityId
            ? localized(dir.cities.find((c) => c.id === e.cityId)?.name)
            : t('console.scope.national'),
    },
  ];

  return (
    <div className="page">
      <PageHeader title={t('console.audit.title')} intro={t('console.audit.intro')} />
      {list.status === 'ready' ? (
        <StatRow
          label={t('console.kpi.label')}
          partial={list.hasMore}
          stats={[
            {
              id: 'entries',
              label: t('console.audit.kpi.entries'),
              value: stats.entries,
              icon: 'shield-check',
            },
            {
              id: 'people',
              label: t('console.audit.kpi.people'),
              value: stats.people,
              icon: 'users-three',
            },
            {
              id: 'exports',
              label: t('console.audit.kpi.exports'),
              value: stats.exports,
              icon: 'download-simple',
            },
          ]}
        />
      ) : null}
      <TableCard
        search={
          <SearchField
            id="audit-search"
            label={t('console.audit.search')}
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
            <TextField
              id="filter-entity"
              label={t('console.audit.filter.entityType')}
              dir="ltr"
              maxLength={60}
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
            />
            <TextField
              id="filter-from"
              type="date"
              label={t('console.audit.filter.from')}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
            <TextField
              id="filter-to"
              type="date"
              label={t('console.audit.filter.to')}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </>
        }
      >
        {list.status === 'loading' ? <Loading /> : null}
        {list.status === 'error' ? <ErrorState error={list.error} onRetry={list.reload} /> : null}
        {list.status === 'ready' && list.items.length === 0 ? (
          <EmptyState title={t('console.audit.empty.title')} body={t('console.audit.empty.body')} />
        ) : null}
        {list.status === 'ready' && list.items.length > 0 && rows.length === 0 ? (
          <NoMatch query={query} partial={list.hasMore} />
        ) : null}
        {list.status === 'ready' && rows.length > 0 ? (
          <DataTable
            caption={t('console.audit.title')}
            columns={columns}
            rows={rows}
            rowKey={(e) => e.id}
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
