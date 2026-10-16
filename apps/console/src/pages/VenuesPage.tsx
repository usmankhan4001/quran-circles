import { useState } from 'react';
import type { Venue } from '@qc/contracts';
import { useSignedIn } from '../api/auth';
import { useDirectory } from '../api/directory';
import { usePaged } from '../api/hooks';
import {
  Badge,
  CheckboxField,
  DataTable,
  EmptyState,
  ErrorState,
  LoadMore,
  Loading,
  PageHeader,
  Phone,
  SelectField,
  type Column,
} from '../components/ui';
import { useI18n } from '../i18n';

/** Venues in the person's scope, including archived ones when asked. */
export default function VenuesPage() {
  const { t, localized } = useI18n();
  const { api } = useSignedIn();
  const dir = useDirectory();
  const [cityId, setCityId] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);

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
      cell: (v) => (v.facilities.womenSection ? t('ui.on') : t('ui.off')),
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
      <div className="filters" role="group" aria-label={t('console.shell.filters')}>
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
      </div>
      {list.status === 'loading' ? <Loading /> : null}
      {list.status === 'error' ? <ErrorState error={list.error} onRetry={list.reload} /> : null}
      {list.status === 'ready' && list.items.length === 0 ? (
        <EmptyState title={t('console.venues.empty.title')} body={t('console.venues.empty.body')} />
      ) : null}
      {list.status === 'ready' && list.items.length > 0 ? (
        <>
          <DataTable
            caption={t('console.venues.title')}
            columns={columns}
            rows={list.items}
            rowKey={(v) => v.id}
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
