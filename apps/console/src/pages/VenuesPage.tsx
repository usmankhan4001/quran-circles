import { Link } from 'react-router';
import { LocationPicker } from '../components/LocationPicker';
import { useMemo, useState } from 'react';
import type { Venue } from '@qc/contracts';
import { useSignedIn } from '../api/auth';
import { useDirectory } from '../api/directory';
import { usePaged } from '../api/hooks';
import { venueStats } from '../lib/kpis';
import {
  AddLink,
  Badge,
  Banner,
  Button,
  Modal,
  CheckboxField,
  DataTable,
  EmptyState,
  ErrorState,
  LoadMore,
  Loading,
  NoMatch,
  PageHeader,
  StatRow,
  Phone,
  TableCard,
  type Column,
} from '../components/ui';
import { Icon } from '../components/icons';
import { useShellCity, useShellSearch } from '../components/ShellFilters';
import { useI18n } from '../i18n';
import { canSomewhere, isNavAllowed } from '../lib/permissions';
import { filterBySearch } from '../lib/search';
import { errorMessageKeyOf } from '../lib/errors';

/** Venues in the person's scope, including archived ones when asked. */
export default function VenuesPage() {
  const { t, localized, number } = useI18n();
  const { api, principal } = useSignedIn();
  const dir = useDirectory();
  const [cityId] = useShellCity();
  const [includeArchived, setIncludeArchived] = useState(false);
  const [locating, setLocating] = useState<Venue | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  const [query] = useShellSearch(t('console.venues.search'));

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
  const venueStat = venueStats(loaded);
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
  const canEdit = canSomewhere(principal, 'venue.update');
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
      id: 'pin',
      header: t('console.venues.col.pin'),
      cell: (v) =>
        v.lat !== null && v.lng !== null ? (
          <Badge tone="success">{t('console.venues.pin.set')}</Badge>
        ) : (
          <Badge tone="warning">{t('console.venues.pin.none')}</Badge>
        ),
    },
    ...(canEdit
      ? [
          {
            id: 'location',
            header: t('console.venues.col.location'),
            cell: (v: Venue) => (
              <Button
                variant="outline"
                className="btn-small"
                onClick={() => {
                  setSaved(false);
                  setSaveError(null);
                  setLocating(v);
                }}
                aria-label={t('console.venues.location.edit', { venue: localized(v.name) })}
              >
                <Icon name="map-pin" size="sm" />
                {t('console.venues.location.set')}
              </Button>
            ),
          },
        ]
      : []),
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
        <StatRow
          label={t('console.kpi.label')}
          partial={list.status === 'ready' && list.hasMore}
          stats={[
            { id: 'venues', label: t('console.kpi.venues'), value: venueStat.active },
            { id: 'women', label: t('console.kpi.womenSection'), value: venueStat.womenSection },
            {
              id: 'contact',
              label: t('console.kpi.noContact'),
              value: venueStat.noContact,
              tone: 'notice',
            },
            { id: 'archived', label: t('console.kpi.archived'), value: venueStat.archived },
          ]}
        />
      ) : null}
      {saved ? (
        <Banner tone="success" onDismiss={() => setSaved(false)}>
          {t('console.venues.location.saved')}
        </Banner>
      ) : null}
      {locating ? (
        <Modal
          title={t('console.venues.location.title', { venue: localized(locating.name) })}
          onClose={() => setLocating(null)}
          footer={null}
        >
          {saveError ? <Banner tone="danger">{t(errorMessageKeyOf(saveError))}</Banner> : null}
          <LocationPicker
            initial={
              locating.lat !== null && locating.lng !== null
                ? { lat: locating.lat, lng: locating.lng }
                : null
            }
            busy={saving}
            onCancel={() => setLocating(null)}
            onUse={(place) => {
              setSaving(true);
              setSaveError(null);
              api.adminVenues
                .update({ params: { venueId: locating.id }, body: place })
                .then(() => {
                  setLocating(null);
                  setSaved(true);
                  list.reload();
                })
                .catch(setSaveError)
                .finally(() => setSaving(false));
            }}
          />
        </Modal>
      ) : null}
      <TableCard
        tabs={
          <>
            {isNavAllowed(principal, 'sessions') ? (
              <Link className="tab-pill" to="/sessions">
                {t('console.venues.tab.sessions')}
              </Link>
            ) : null}
            <span className="tab-pill tab-pill-on" aria-current="page">
              {t('console.sessions.tab.venues', { count: number(loaded.length) })}
            </span>
          </>
        }
        filtersLabel={t('console.shell.filters')}
        filters={
          <>
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
