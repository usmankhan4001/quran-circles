import { useMemo, useState } from 'react';
import type { Venue } from '@qc/contracts';
import { useSignedIn } from '../api/auth';
import { useDirectory } from '../api/directory';
import { usePaged } from '../api/hooks';
import {
  AddLink,
  Badge,
  CheckboxField,
  DataTable,
  EmptyState,
  ErrorState,
  LoadMore,
  Loading,
  NoMatch,
  PageHeader,
  Phone,
  SearchField,
  SelectField,
  StatRow,
  TableCard,
  type Column,
  type Stat,
} from '../components/ui';
import { useI18n } from '../i18n';
import { venueStats } from '../lib/kpis';
import { canSomewhere, isNavAllowed } from '../lib/permissions';
import { filterBySearch } from '../lib/search';

/** Venues in the person's scope, including archived ones when asked. */
export default function VenuesPage() {
  const { t, localized } = useI18n();
  const { api, principal } = useSignedIn();
  const dir = useDirectory();
  const [cityId, setCityId] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [query, setQuery] = useState('');

  const list = usePaged(
    (cursor) =>
      api.adminVenues.list({
        query: {
          limit: 50,
          cursor,
          includeArchived: includeArchived ? 'true' : 'false',
          ...(cityId ? { cityId } : {}),
        },
      }),
    [api, cityId, includeArchived],
  );

  const loaded = list.status === 'ready' ? list.items : [];
  const stats = useMemo(() => venueStats(loaded), [loaded]);
  const rows = useMemo(
    () =>
      filterBySearch(loaded, query, (v) => [
        v.name,
        v.address,
        v.contactPhone,
        dir.cityName(v.cityId),
      ]),
    [loaded, query, dir],
  );
  // Venues are added through the bulk import; the console has no single-venue form yet.
  const canAdd = isNavAllowed(principal, 'import') && canSomewhere(principal, 'venue.create');
  const statCards: Stat[] = [
    { id: 'active', label: t('console.venues.kpi.active'), value: stats.active, icon: 'mosque' },
    {
      id: 'women',
      label: t('console.venues.kpi.womenSection'),
      value: stats.womenSection,
      icon: 'users-three',
    },
    {
      id: 'noContact',
      label: t('console.venues.kpi.noContact'),
      value: stats.noContact,
      tone: 'notice',
      icon: 'warning-circle',
    },
    ...(includeArchived
      ? [{ id: 'archived', label: t('console.venues.kpi.archived'), value: stats.archived }]
      : []),
  ];

  const columns: Column<Venue>[] = [
    {
      id: 'name',
      header: t('console.venues.col.name'),
      rowHeader: true,
      cell: (v) => localized(v.name),
    },
    { id: 'city', header: t('console.venues.col.city'), cell: (v) => dir.cityName(v.cityId) },
    { id: 'address', header: t('console.venues.col.address'), cell: (v) => localized(v.address) },
    {
      id: 'phone',
      header: t('console.venues.col.phone'),
      cell: (v) => <Phone value={v.contactPhone} />,
    },
    {
      id: 'women',
      header: t('console.venues.col.womenSection'),
      cell: (v) =>
        v.facilities.womenSection ? (
          <Badge tone="accent">{t('ui.on')}</Badge>
        ) : (
          <Badge>{t('ui.off')}</Badge>
        ),
    },
    {
      id: 'status',
      header: t('console.venues.col.status'),
      cell: (v) =>
        v.status === 'active' ? (
          <Badge tone="success">{t('console.venues.status.active')}</Badge>
        ) : (
          <Badge>{t('console.venues.status.archived')}</Badge>
        ),
    },
  ];

  return (
    <div className="page">
      <PageHeader title={t('console.venues.title')} intro={t('console.venues.intro')} />
      {list.status === 'ready' ? (
        <StatRow label={t('console.kpi.label')} partial={list.hasMore} stats={statCards} />
      ) : null}
      <TableCard
        search={
          <SearchField
            id="venues-search"
            label={t('console.venues.search')}
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
              onChange={(e) => setCityId(e.target.value)}
              options={dir.cities.map((c) => ({ value: c.id, label: localized(c.name) }))}
            />
            <CheckboxField
              label={t('console.venues.includeArchived')}
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
            />
          </>
        }
        action={
          canAdd ? <AddLink to="/import?kind=venues">{t('console.venues.add')}</AddLink> : null
        }
      >
        {list.status === 'loading' ? <Loading /> : null}
        {list.status === 'error' ? <ErrorState error={list.error} onRetry={list.reload} /> : null}
        {list.status === 'ready' && list.items.length === 0 ? (
          <EmptyState
            title={t('console.venues.empty.title')}
            body={t('console.venues.empty.body')}
          />
        ) : null}
        {list.status === 'ready' && list.items.length > 0 && rows.length === 0 ? (
          <NoMatch query={query} partial={list.hasMore} />
        ) : null}
        {list.status === 'ready' && rows.length > 0 ? (
          <DataTable
            caption={t('console.venues.title')}
            columns={columns}
            rows={rows}
            rowKey={(v) => v.id}
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
